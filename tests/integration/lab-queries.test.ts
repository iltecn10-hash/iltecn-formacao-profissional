/* eslint-disable @typescript-eslint/no-explicit-any -- gabaritos JSON de teste */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";
import { solve } from "../setup/labSolver";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: {
    connect: (...args: unknown[]) => (testDb.pool.connect as (...a: unknown[]) => unknown)(...args),
  },
  query: (...args: [string, unknown[]?]) => testDb.query(...args),
  queryOne: (...args: [string, unknown[]?]) => testDb.queryOne(...args),
}));

const { seedLabProgram } = await import("@/modules/lab/seed");
const lab = await import("@/modules/lab/queries");

const db = () => ({ query: async (t: string, p?: unknown[]) => ({ rows: await testDb.query(t, p) }) });

async function makeStudent(audience: "kids" | "professional" = "kids", email = "a@x.com") {
  const school =
    (await testDb.queryOne<{ id: string }>(`SELECT id FROM schools LIMIT 1`)) ??
    (await testDb.queryOne<{ id: string }>(`INSERT INTO schools (name) VALUES ('Escola') RETURNING id`));
  const user = await testDb.queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,'h','Maria Aparecida Souza','student') RETURNING id`,
    [email]
  );
  const s = await testDb.queryOne<{ id: string }>(
    `INSERT INTO students (user_id, school_id, audience) VALUES ($1,$2,$3) RETURNING id`,
    [user!.id, school!.id, audience]
  );
  return s!.id;
}

async function lessonId(n: number) {
  return (await testDb.queryOne<{ id: string }>(`SELECT id FROM missions WHERE sort_order = $1`, [n]))!.id;
}

async function doAllActivities(studentId: string, n: number) {
  const id = await lessonId(n);
  const detail = await lab.getLabLesson(studentId, id, db());
  const rows = await testDb.query<{ id: string; kind: any; config: any }>(
    `SELECT id, kind, config FROM mission_activities WHERE mission_id = $1`,
    [id]
  );
  for (const a of rows) {
    const r = await lab.submitActivity(studentId, a.id, solve(a.kind, a.config));
    expect(r.correct).toBe(true);
  }
  return detail;
}

describe("ILTECN LAB — consultas", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await seedLabProgram(db());
  });

  it("aluno profissional não acessa o programa infantil", async () => {
    const pro = await makeStudent("professional");
    expect(await lab.getLabOverview(pro, db())).toBeNull();
    await expect(lab.getLabLesson(pro, await lessonId(1), db())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a aula 2 fica bloqueada até concluir a 1 (no servidor)", async () => {
    const s = await makeStudent();
    await expect(lab.getLabLesson(s, await lessonId(2), db())).rejects.toMatchObject({ code: "locked" });
    const ov = await lab.getLabOverview(s, db());
    expect(ov!.lessons[0].state).toBe("available");
    expect(ov!.lessons[1].state).toBe("locked");
    expect(ov!.lessonsTotal).toBe(30);
  });

  it("não vaza o gabarito para o navegador", async () => {
    const s = await makeStudent();
    const detail = await lab.getLabLesson(s, await lessonId(1), db());
    const json = JSON.stringify(detail.activities);
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain('"goals"');
  });

  it("errar não paga XP e acertar paga uma vez só", async () => {
    const s = await makeStudent();
    const id = await lessonId(1);
    const a = (await testDb.queryOne<any>(`SELECT id, kind, config, xp FROM mission_activities WHERE mission_id = $1 ORDER BY sort_order LIMIT 1`, [id]))!;

    const wrong = await lab.submitActivity(s, a.id, { nada: true });
    expect(wrong.correct).toBe(false);
    expect(wrong.xpAwarded).toBe(0);

    const ok = await lab.submitActivity(s, a.id, solve(a.kind, a.config));
    expect(ok.correct).toBe(true);
    expect(ok.xpAwarded).toBe(a.xp);
    expect(ok.score).toBe(80);

    const again = await lab.submitActivity(s, a.id, solve(a.kind, a.config));
    expect(again.xpAwarded).toBe(0);
    expect(again.alreadyCompleted).toBe(true);

    const pts = await testDb.queryOne<{ points: number }>(`SELECT points FROM students WHERE id = $1`, [s]);
    expect(pts!.points).toBe(a.xp);
  });

  it("não deixa concluir a aula com atividades faltando", async () => {
    const s = await makeStudent();
    await expect(lab.completeLabLesson(s, await lessonId(1))).rejects.toMatchObject({ code: "incomplete" });
  });

  it("conclui a aula 1, libera a 2, concede medalha e é idempotente", async () => {
    const s = await makeStudent();
    await doAllActivities(s, 1);
    const first = await lab.completeLabLesson(s, await lessonId(1));
    expect(first.alreadyCompleted).toBe(false);
    expect(first.pointsAwarded).toBeGreaterThan(0);
    const pointsAfter = (await testDb.queryOne<{ points: number }>(`SELECT points FROM students WHERE id = $1`, [s]))!.points;

    const second = await lab.completeLabLesson(s, await lessonId(1));
    expect(second.alreadyCompleted).toBe(true);
    expect(second.pointsAwarded).toBe(0);
    expect((await testDb.queryOne<{ points: number }>(`SELECT points FROM students WHERE id = $1`, [s]))!.points).toBe(pointsAfter);

    await expect(lab.getLabLesson(s, await lessonId(2), db())).resolves.toBeTruthy();
    const ov = await lab.getLabOverview(s, db());
    expect(ov!.lessonsDone).toBe(1);
    expect(ov!.achievements.some((a) => a.code === "lab_primeiro_acesso" && a.earned_at)).toBe(true);
  });

  it("aulas de documento exigem o trabalho entregue", async () => {
    const s = await makeStudent();
    for (let n = 1; n <= 21; n++) {
      await doAllActivities(s, n);
      await lab.completeLabLesson(s, await lessonId(n));
    }
    await doAllActivities(s, 22);
    await expect(lab.completeLabLesson(s, await lessonId(22))).rejects.toMatchObject({ code: "work_required" });
    await testDb.query(
      `INSERT INTO student_works (student_id, mission_id, work_type, status) VALUES ($1,$2,'DOCUMENT','SUBMITTED')`,
      [s, await lessonId(22)]
    );
    await expect(lab.completeLabLesson(s, await lessonId(22))).resolves.toBeTruthy();
  }, 60000);

  it("programa completo: certificado emitido uma vez e validação pública minimiza dados", async () => {
    const s = await makeStudent();
    for (let n = 1; n <= 30; n++) {
      await doAllActivities(s, n);
      if ([22, 23, 26].includes(n)) {
        await testDb.query(
          `INSERT INTO student_works (student_id, mission_id, work_type, status) VALUES ($1,$2,'DOCUMENT','SUBMITTED')`,
          [s, await lessonId(n)]
        );
      }
      await lab.completeLabLesson(s, await lessonId(n));
    }
    const ov = await lab.getLabOverview(s, db());
    expect(ov!.lessonsDone).toBe(30);
    expect(ov!.certificate?.code).toMatch(/^ILT-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(ov!.level.name).toBe("Mestre Digital");
    expect(ov!.achievements.every((a) => a.earned_at)).toBe(true);

    const again = await lab.completeLabLesson(s, await lessonId(30));
    expect(again.certificate?.code).toBe(ov!.certificate!.code);
    const certs = await testDb.query(`SELECT id FROM track_certificates`);
    expect(certs.length).toBe(1);

    const pub = await lab.validateCertificate(ov!.certificate!.code.toLowerCase());
    expect(pub?.studentLabel).toBe("Maria S.");
    expect(JSON.stringify(pub)).not.toContain("Aparecida");
    expect(await lab.validateCertificate("ILT-AAAA-BBBB")).toBeNull();
    expect(await lab.validateCertificate("' OR 1=1 --")).toBeNull();
  }, 60000);

  it("conquistas e progresso do profissional não são afetados pelo programa infantil", async () => {
    const pro = await makeStudent("professional", "p@x.com");
    const { listAchievementsForStudent } = await import("@/modules/achievements/queries");
    const list = await listAchievementsForStudent(pro);
    expect(list.some((a) => a.name === "Primeiro acesso")).toBe(false);
  });
});
