/* eslint-disable @typescript-eslint/no-explicit-any -- gabaritos JSON de teste */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";
import { solve } from "../setup/labSolver";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const { seedGames } = await import("@/modules/games/seed");
const g = await import("@/modules/games/queries");
const r = await import("@/modules/games/results");
const { exploradorDigital } = await import("@/lib/games/content/explorador-digital");

const db = () => ({ query: async (t: string, p?: unknown[]) => ({ rows: await testDb.query(t, p) }) });
async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
async function student(name: string, schoolId: string, audience = "professional") {
  const u = await mk("users", "email, password_hash, name, role", [`${name}@x.com`, "h", name, "student"]);
  return mk("students", "user_id, school_id, audience", [u, schoolId, audience]);
}

describe("resultados do jogo — escopo e isolamento", () => {
  let gameId: string, schoolA: string, schoolB: string, classA: string, classB: string;
  let ana: string, bia: string, caio: string;
  let teacherA: any, teacherB: any, coordA: any, adm: any, stu: any;

  beforeEach(async () => {
    testDb = createTestDb();
    await seedGames(db());
    gameId = (await testDb.queryOne<{ id: string }>(`SELECT id FROM games`))!.id;
    schoolA = await mk("schools", "name", ["Escola A"]);
    schoolB = await mk("schools", "name", ["Escola B"]);
    const tuA = await mk("users", "email, password_hash, name, role", ["ta@x.com", "h", "Prof A", "teacher"]);
    const tuB = await mk("users", "email, password_hash, name, role", ["tb@x.com", "h", "Prof B", "teacher"]);
    const cu = await mk("users", "email, password_hash, name, role", ["c@x.com", "h", "Coord A", "coordinator"]);
    const au = await mk("users", "email, password_hash, name, role", ["ad@x.com", "h", "Admin", "admin"]);
    const tA = await mk("teachers", "user_id, school_id", [tuA, schoolA]);
    const tB = await mk("teachers", "user_id, school_id", [tuB, schoolB]);
    await mk("coordinators", "user_id, school_id", [cu, schoolA]);
    classA = await mk("classes", "school_id, teacher_id, name", [schoolA, tA, "Turma A"]);
    classB = await mk("classes", "school_id, teacher_id, name", [schoolB, tB, "Turma B"]);
    ana = await student("Ana", schoolA);
    bia = await student("Bia", schoolB);
    caio = await student("Caio", schoolA);
    await mk("enrollments", "student_id, class_id", [ana, classA]);
    await mk("enrollments", "student_id, class_id", [caio, classA]);
    await mk("enrollments", "student_id, class_id", [bia, classB]);
    teacherA = { userId: tuA, role: "teacher" };
    teacherB = { userId: tuB, role: "teacher" };
    coordA = { userId: cu, role: "coordinator" };
    adm = { userId: au, role: "admin" };
    stu = { userId: tuA, role: "student" };

    // Ana joga e passa; Bia erra tudo da fase 2; Caio nem começa.
    const a = await g.startAttempt(ana, gameId);
    for (const ph of exploradorDigital.config.phases) for (const ch of ph.challenges) await g.submitChallenge(ana, a.id, ch.id, solve(ch.kind, ch.config));
    await g.finishAttempt(ana, a.id);
    for (let n = 0; n < 2; n++) {
      const b = await g.startAttempt(bia, gameId);
      for (const ch of exploradorDigital.config.phases[0].challenges) await g.submitChallenge(bia, b.id, ch.id, solve(ch.kind, ch.config));
      for (const ch of exploradorDigital.config.phases[1].challenges) for (let i = 0; i < ch.maxTries; i++) await g.submitChallenge(bia, b.id, ch.id, {});
      await g.finishAttempt(bia, b.id);
    }
  });

  const ids = async (actor: any) => (await r.getGameResults(actor, gameId)).students.map((s) => s.id).sort();

  it("professor vê só a sua turma; coordenador só a escola; admin todos", async () => {
    expect(await ids(teacherA)).toEqual([ana, caio].sort());
    expect(await ids(teacherB)).toEqual([bia]);
    expect(await ids(coordA)).toEqual([ana, caio].sort());
    expect(await ids(adm)).toEqual([ana, bia, caio].sort());
  });

  it("aluno não acessa resultados (perfil sem permissão)", async () => {
    await expect(r.getGameResults(stu, gameId)).rejects.toMatchObject({ code: "forbidden" });
    expect(await r.listGamesForStaff(stu)).toEqual([]);
    expect(await r.listScopedStudents(stu, "all")).toEqual([]);
  });

  it("indicadores: iniciados, concluídos, notas, tentativas, apoio e habilidades", async () => {
    const res = await r.getGameResults(adm, gameId);
    expect(res.totals).toMatchObject({ students: 3, started: 2, completed: 1, needSupport: 1 });
    const byId = Object.fromEntries(res.students.map((s) => [s.id, s]));
    expect(byId[ana]).toMatchObject({ status: "completed", attempts: 1, bestPercent: 100, needsSupport: null });
    expect(byId[bia]).toMatchObject({ status: "failed", attempts: 2 });
    expect(byId[bia].needsSupport).toMatch(/2 tentativas/);
    expect(byId[bia].evolution).toHaveLength(2);
    expect(byId[caio].status).toBe("not_started");
    expect(res.skills.length).toBeGreaterThan(0);
    expect(res.hardest.length).toBeGreaterThan(0);
    expect(res.hardest[0].wrongRate).toBeGreaterThan(0);
  });

  it("filtro por turma respeita o escopo (professor B não enxerga a turma A)", async () => {
    const mine = await r.getGameResults(teacherA, gameId, { classId: classA });
    expect(mine.students.map((s) => s.id).sort()).toEqual([ana, caio].sort());
    const foreign = await r.getGameResults(teacherB, gameId, { classId: classA });
    expect(foreign.students).toEqual([]);
  });

  it("o resultado nunca traz respostas: só números e rótulos", async () => {
    const text = JSON.stringify(await r.getGameResults(adm, gameId));
    for (const forbidden of ['"answer"', '"submission"', '"state"', '"goals"']) expect(text).not.toContain(forbidden);
  });

  it("rascunho: só o administrador vê os resultados", async () => {
    await testDb.query(`UPDATE games SET status='draft'`);
    await expect(r.getGameResults(teacherA, gameId)).rejects.toMatchObject({ code: "not_found" });
    expect((await r.getGameResults(adm, gameId)).game.status).toBe("draft");
    expect(await r.listGamesForStaff(teacherA)).toEqual([]);
    expect(await r.listGamesForStaff(adm)).toHaveLength(1);
  });

  it("turmas do filtro seguem o mesmo escopo", async () => {
    expect((await r.listActorClasses(teacherA)).map((c) => c.id)).toEqual([classA]);
    expect((await r.listActorClasses(coordA)).map((c) => c.id)).toEqual([classA]);
    expect((await r.listActorClasses(adm)).map((c) => c.id).sort()).toEqual([classA, classB].sort());
    expect(await r.listActorClasses(stu)).toEqual([]);
  });
});
