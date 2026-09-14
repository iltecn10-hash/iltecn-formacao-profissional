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
  saveStudentWorkContent,
  submitStudentWork,
  listStudentWorkVersions,
  listStudentWorksByStudent,
  StudentWorkNotEditableError,
} = await import("@/modules/student-works/queries");

async function seedStudentAndMission() {
  const user = await testDb.queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'student') RETURNING id`,
    ["aluno-fase9@teste.com", "hash", "Aluno Fase 9"]
  );
  const school = await testDb.queryOne<{ id: string }>(
    `INSERT INTO schools (name) VALUES ('Escola Teste') RETURNING id`
  );
  const student = await testDb.queryOne<{ id: string }>(
    `INSERT INTO students (user_id, school_id) VALUES ($1,$2) RETURNING id`,
    [user!.id, school!.id]
  );
  const track = await testDb.queryOne<{ id: string }>(
    `INSERT INTO tracks (name, slug) VALUES ('Informática', 'informatica') RETURNING id`
  );
  const mod = await testDb.queryOne<{ id: string }>(
    `INSERT INTO modules (track_id, name) VALUES ($1, 'Documentos') RETURNING id`,
    [track!.id]
  );
  const mission = await testDb.queryOne<{ id: string }>(
    `INSERT INTO missions (module_id, title, points_value) VALUES ($1, 'Memorando', 100) RETURNING id`,
    [mod!.id]
  );

  return { studentId: student!.id, missionId: mission!.id };
}

describe("student-works — Fase 9.1", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("cria o trabalho e uma tentativa de missão associada na primeira vez", async () => {
    const { studentId, missionId } = await seedStudentAndMission();

    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");

    expect(work.student_id).toBe(studentId);
    expect(work.mission_id).toBe(missionId);
    expect(work.work_type).toBe("DOCUMENT");
    expect(work.status).toBe("DRAFT");
    expect(work.mission_attempt_id).toBeTruthy();

    const attempt = await testDb.queryOne<{ status: string }>(
      `SELECT status FROM mission_attempts WHERE student_id = $1 AND mission_id = $2`,
      [studentId, missionId]
    );
    expect(attempt?.status).toBe("em_andamento");
  });

  it("não duplica o trabalho ao chamar de novo para o mesmo aluno/missão/tipo", async () => {
    const { studentId, missionId } = await seedStudentAndMission();

    const first = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");
    const second = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");

    expect(second.id).toBe(first.id);

    const all = await listStudentWorksByStudent(studentId);
    expect(all).toHaveLength(1);
  });

  it("permite DOCUMENT e SPREADSHEET separados para a mesma missão (seção 42)", async () => {
    const { studentId, missionId } = await seedStudentAndMission();

    const doc = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");
    const sheet = await getOrCreateStudentWork(studentId, missionId, "SPREADSHEET");

    expect(doc.id).not.toBe(sheet.id);
    const all = await listStudentWorksByStudent(studentId);
    expect(all).toHaveLength(2);
  });

  it("autosave grava conteúdo, incrementa versão e sai de DRAFT", async () => {
    const { studentId, missionId } = await seedStudentAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");

    const saved = await saveStudentWorkContent(work.id, studentId, {
      content: { blocks: [{ type: "paragraph", text: "Olá" }] },
    });

    expect(saved.status).toBe("IN_PROGRESS");
    expect(saved.version).toBe(work.version + 1);
    expect(saved.content).toEqual({ blocks: [{ type: "paragraph", text: "Olá" }] });
  });

  it("impede que outro aluno salve o trabalho (isolamento de propriedade)", async () => {
    const { studentId, missionId } = await seedStudentAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");

    const otherUser = await testDb.queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'student') RETURNING id`,
      ["outro-aluno@teste.com", "hash", "Outro Aluno"]
    );
    const school = await testDb.queryOne<{ id: string }>(
      `SELECT id FROM schools LIMIT 1`
    );
    const otherStudent = await testDb.queryOne<{ id: string }>(
      `INSERT INTO students (user_id, school_id) VALUES ($1,$2) RETURNING id`,
      [otherUser!.id, school!.id]
    );

    await expect(
      saveStudentWorkContent(work.id, otherStudent!.id, { content: { hacked: true } })
    ).rejects.toThrow("Trabalho não encontrado.");
  });

  it("entrega cria uma versão final e bloqueia edição posterior", async () => {
    const { studentId, missionId } = await seedStudentAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");
    await saveStudentWorkContent(work.id, studentId, {
      content: { blocks: ["conteúdo final"] },
    });

    const submitted = await submitStudentWork(work.id, studentId);
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submitted_at).toBeTruthy();

    const versions = await listStudentWorkVersions(work.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].label).toBe("Entrega final");

    await expect(
      saveStudentWorkContent(work.id, studentId, { content: { blocks: ["outra coisa"] } })
    ).rejects.toThrow(StudentWorkNotEditableError);
  });

  it("entregar duas vezes é idempotente: não duplica versão", async () => {
    const { studentId, missionId } = await seedStudentAndMission();
    const work = await getOrCreateStudentWork(studentId, missionId, "DOCUMENT");

    await submitStudentWork(work.id, studentId);
    await submitStudentWork(work.id, studentId);

    const versions = await listStudentWorkVersions(work.id);
    expect(versions).toHaveLength(1);
  });
});
