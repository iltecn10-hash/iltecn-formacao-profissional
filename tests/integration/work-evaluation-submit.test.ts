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

const { getOrCreateStudentWork, saveStudentWorkContent, submitStudentWork, listWorkEvaluations } =
  await import("@/modules/student-works/queries");

/**
 * Fase 9.5: a entrega (`submitStudentWork`) passa a gravar uma avaliação
 * automática em `work_evaluations`, calculada uma única vez sobre o
 * conteúdo que acabou de ser travado.
 */
async function seedStudentAndMission() {
  const user = await testDb.queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'student') RETURNING id`,
    ["aluno-fase9.5@teste.com", "hash", "Aluno Fase 9.5"]
  );
  const school = await testDb.queryOne<{ id: string }>(
    `INSERT INTO schools (name) VALUES ('Escola Teste') RETURNING id`
  );
  const student = await testDb.queryOne<{ id: string }>(
    `INSERT INTO students (user_id, school_id) VALUES ($1,$2) RETURNING id`,
    [user!.id, school!.id]
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

  return { studentId: student!.id, missionId: mission!.id };
}

describe("submitStudentWork — avaliação automática (Fase 9.5)", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("grava uma avaliação AUTO reprovada quando faltam campos obrigatórios", async () => {
    const { studentId, missionId } = await seedStudentAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT", {
      templateKey: "memorando",
    });
    await saveStudentWorkContent(work.id, studentId, {
      content: { fields: { numero: "01/2026" }, rich: {} },
    });

    await submitStudentWork(work.id, studentId);

    const evaluations = await listWorkEvaluations(work.id);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].evaluation_type).toBe("AUTO");
    expect(evaluations[0].passed).toBe(false);
    expect(evaluations[0].score).toBeLessThan(100);
  });

  it("grava uma avaliação AUTO aprovada quando todos os campos obrigatórios estão preenchidos", async () => {
    const { studentId, missionId } = await seedStudentAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT", {
      templateKey: "memorando",
    });
    await saveStudentWorkContent(work.id, studentId, {
      content: {
        fields: {
          numero: "01/2026",
          data: "2026-09-14",
          destinatario: "Equipe",
          remetente: "RH",
          assunto: "Aviso",
        },
        rich: {
          conteudo: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Aviso importante." }] }],
          },
        },
      },
    });

    await submitStudentWork(work.id, studentId);

    const evaluations = await listWorkEvaluations(work.id);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].passed).toBe(true);
    expect(evaluations[0].score).toBe(100);
  });

  it("entregar duas vezes não duplica a avaliação automática (idempotente)", async () => {
    const { studentId, missionId } = await seedStudentAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT", {
      templateKey: "memorando",
    });

    await submitStudentWork(work.id, studentId);
    await submitStudentWork(work.id, studentId);

    const evaluations = await listWorkEvaluations(work.id);
    expect(evaluations).toHaveLength(1);
  });
});
