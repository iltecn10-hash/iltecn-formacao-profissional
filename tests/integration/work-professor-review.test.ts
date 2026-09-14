import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: {
    connect: (...args: unknown[]) =>
      (testDb.pool.connect as (...a: unknown[]) => unknown)(...args),
  },
  query: (...args: [string, unknown[]?]) => testDb.query(...args),
  queryOne: (...args: [string, unknown[]?]) => testDb.queryOne(...args),
}));

const {
  getOrCreateStudentWork,
  submitStudentWork,
  listWorkComments,
  addWorkComment,
  recordManualEvaluation,
  listWorkEvaluations,
  getStudentWorkById,
  WorkNotSubmittedError,
} = await import("@/modules/student-works/queries");

/**
 * Fase 9.6: comentários (aluno ↔ professor) e avaliação manual, que decide
 * o destino do trabalho (APPROVED ou RETURNED).
 */
async function seedStudentTeacherAndMission() {
  const student_user = await testDb.queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'student') RETURNING id`,
    ["aluno-fase9.6@teste.com", "hash", "Aluno Fase 9.6"]
  );
  const teacher_user = await testDb.queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'teacher') RETURNING id`,
    ["professor-fase9.6@teste.com", "hash", "Professor Fase 9.6"]
  );
  const school = await testDb.queryOne<{ id: string }>(
    `INSERT INTO schools (name) VALUES ('Escola Teste') RETURNING id`
  );
  const student = await testDb.queryOne<{ id: string }>(
    `INSERT INTO students (user_id, school_id) VALUES ($1,$2) RETURNING id`,
    [student_user!.id, school!.id]
  );
  const track = await testDb.queryOne<{ id: string }>(
    `INSERT INTO tracks (name, slug) VALUES ('Documentos', 'documentos') RETURNING id`
  );
  const mod = await testDb.queryOne<{ id: string }>(
    `INSERT INTO modules (track_id, name) VALUES ($1, 'Editor de Texto') RETURNING id`,
    [track!.id]
  );
  const mission = await testDb.queryOne<{ id: string }>(
    `INSERT INTO missions (module_id, title, points_value) VALUES ($1, 'Memorando', 100) RETURNING id`,
    [mod!.id]
  );

  return { studentId: student!.id, missionId: mission!.id, teacherId: teacher_user!.id };
}

describe("work_comments (Fase 9.6)", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("lista comentários em ordem cronológica com o nome do autor", async () => {
    const { studentId, missionId, teacherId } = await seedStudentTeacherAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");

    await addWorkComment(work.id, teacherId, "Faltou a data.");
    await addWorkComment(work.id, teacherId, "E a assinatura também.");

    const comments = await listWorkComments(work.id);
    expect(comments).toHaveLength(2);
    expect(comments[0].body).toBe("Faltou a data.");
    expect(comments[1].body).toBe("E a assinatura também.");
    expect(comments[0].author_name).toBe("Professor Fase 9.6");
  });
});

describe("recordManualEvaluation (Fase 9.6)", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("recusa avaliar um trabalho que nunca foi entregue", async () => {
    const { studentId, missionId, teacherId } = await seedStudentTeacherAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");

    await expect(
      recordManualEvaluation(work.id, teacherId, { passed: true })
    ).rejects.toThrow(WorkNotSubmittedError);
  });

  it("aprovar muda o status para APPROVED e grava a avaliação MANUAL", async () => {
    const { studentId, missionId, teacherId } = await seedStudentTeacherAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");
    await submitStudentWork(work.id, studentId);

    const evaluation = await recordManualEvaluation(work.id, teacherId, {
      passed: true,
      score: 95,
      feedback: "Muito bom.",
    });
    expect(evaluation.evaluation_type).toBe("MANUAL");
    expect(evaluation.passed).toBe(true);

    const updated = await getStudentWorkById(work.id);
    expect(updated?.status).toBe("APPROVED");

    const evaluations = await listWorkEvaluations(work.id);
    expect(evaluations.some((e) => e.evaluation_type === "MANUAL" && e.passed === true)).toBe(
      true
    );
  });

  it("devolver muda o status para RETURNED, reabrindo o trabalho para o aluno", async () => {
    const { studentId, missionId, teacherId } = await seedStudentTeacherAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");
    await submitStudentWork(work.id, studentId);

    await recordManualEvaluation(work.id, teacherId, {
      passed: false,
      feedback: "Revise o campo de assunto.",
    });

    const updated = await getStudentWorkById(work.id);
    expect(updated?.status).toBe("RETURNED");
  });

  it("aluno entrega de novo depois de devolvido: nova versão e nova avaliação AUTO", async () => {
    const { studentId, missionId, teacherId } = await seedStudentTeacherAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");
    await submitStudentWork(work.id, studentId);
    await recordManualEvaluation(work.id, teacherId, { passed: false });

    const resubmitted = await submitStudentWork(work.id, studentId);
    expect(resubmitted.status).toBe("SUBMITTED");

    const evaluations = await listWorkEvaluations(work.id);
    expect(evaluations.filter((e) => e.evaluation_type === "AUTO")).toHaveLength(2);
  });
});
