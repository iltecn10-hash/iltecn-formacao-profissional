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

const { completeMissionAttempt } = await import("@/modules/missions/queries");

async function seedBasicMission() {
  const user = await testDb.queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'student') RETURNING id`,
    ["aluno@teste.com", "hash", "Aluno Teste"]
  );
  const school = await testDb.queryOne<{ id: string }>(
    `INSERT INTO schools (name) VALUES ('Escola Teste') RETURNING id`
  );
  const student = await testDb.queryOne<{ id: string }>(
    `INSERT INTO students (user_id, school_id) VALUES ($1,$2) RETURNING id`,
    [user!.id, school!.id]
  );
  const track = await testDb.queryOne<{ id: string }>(
    `INSERT INTO tracks (name, slug) VALUES ('Excel', 'excel') RETURNING id`
  );
  const mod = await testDb.queryOne<{ id: string }>(
    `INSERT INTO modules (track_id, name) VALUES ($1, 'Planilhas') RETURNING id`,
    [track!.id]
  );
  const competency = await testDb.queryOne<{ id: string }>(
    `INSERT INTO competencies (name) VALUES ('Excel') RETURNING id`
  );
  const mission = await testDb.queryOne<{ id: string }>(
    `INSERT INTO missions (module_id, title, points_value) VALUES ($1, 'Missão Teste', 100) RETURNING id`,
    [mod!.id]
  );
  await testDb.query(
    `INSERT INTO mission_competencies (mission_id, competency_id) VALUES ($1, $2)`,
    [mission!.id, competency!.id]
  );
  await testDb.query(
    `INSERT INTO achievements (code, name, criteria_type, criteria_value) VALUES ('primeira_missao', 'Primeira Missão', 'missions_completed', 1)`
  );

  return { studentId: student!.id, missionId: mission!.id };
}

describe("completeMissionAttempt", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("credita os pontos e concede a conquista na primeira conclusão", async () => {
    const { studentId, missionId } = await seedBasicMission();

    await completeMissionAttempt(studentId, missionId);

    const student = await testDb.queryOne<{ points: number }>(
      `SELECT points FROM students WHERE id = $1`,
      [studentId]
    );
    expect(student?.points).toBe(100);

    const achievements = await testDb.query(
      `SELECT * FROM student_achievements WHERE student_id = $1`,
      [studentId]
    );
    expect(achievements).toHaveLength(1);

    const competencyScore = await testDb.queryOne<{ score: number }>(
      `SELECT score FROM student_competencies WHERE student_id = $1`,
      [studentId]
    );
    expect(competencyScore?.score).toBe(10);
  });

  it("é idempotente: concluir a mesma missão duas vezes não credita pontos em dobro", async () => {
    const { studentId, missionId } = await seedBasicMission();

    await completeMissionAttempt(studentId, missionId);
    await completeMissionAttempt(studentId, missionId);

    const student = await testDb.queryOne<{ points: number }>(
      `SELECT points FROM students WHERE id = $1`,
      [studentId]
    );
    expect(student?.points).toBe(100);

    const achievements = await testDb.query(
      `SELECT * FROM student_achievements WHERE student_id = $1`,
      [studentId]
    );
    expect(achievements).toHaveLength(1);
  });
});
