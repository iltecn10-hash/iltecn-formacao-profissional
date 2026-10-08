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

const { seedLabProgram } = await import("@/modules/lab/seed");
const lab = await import("@/modules/lab/queries");
const mon = await import("@/modules/lab/monitor");
const db = () => ({ query: async (t: string, p?: unknown[]) => ({ rows: await testDb.query(t, p) }) });

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}

async function student(name: string, schoolId: string, audience = "kids") {
  const u = await mk("users", "email, password_hash, name, role", [`${name}@x.com`, "h", name, "student"]);
  return mk("students", "user_id, school_id, audience", [u, schoolId, audience]);
}

describe("monitor do professor — isolamento por perfil", () => {
  let schoolA: string, schoolB: string, classA: string, classB: string;
  let alunoA: string, alunoB: string, alunoPro: string;
  let teacherA: { userId: string }, teacherB: { userId: string }, coordA: { userId: string }, admin: { userId: string };

  beforeEach(async () => {
    testDb = createTestDb();
    await seedLabProgram(db());
    schoolA = await mk("schools", "name", ["Escola A"]);
    schoolB = await mk("schools", "name", ["Escola B"]);
    const tuA = await mk("users", "email, password_hash, name, role", ["ta@x.com", "h", "Prof A", "teacher"]);
    const tuB = await mk("users", "email, password_hash, name, role", ["tb@x.com", "h", "Prof B", "teacher"]);
    const cu = await mk("users", "email, password_hash, name, role", ["c@x.com", "h", "Coord A", "coordinator"]);
    const au = await mk("users", "email, password_hash, name, role", ["ad@x.com", "h", "Admin", "admin"]);
    const tA = await mk("teachers", "user_id, school_id", [tuA, schoolA]);
    const tB = await mk("teachers", "user_id, school_id", [tuB, schoolB]);
    await mk("coordinators", "user_id, school_id", [cu, schoolA]);
    classA = await mk("classes", "school_id, teacher_id, name", [schoolA, tA, "3º A"]);
    classB = await mk("classes", "school_id, teacher_id, name", [schoolB, tB, "3º B"]);
    alunoA = await student("Ana", schoolA);
    alunoB = await student("Bia", schoolB);
    alunoPro = await student("Carlos", schoolA, "professional");
    await mk("enrollments", "student_id, class_id", [alunoA, classA]);
    await mk("enrollments", "student_id, class_id", [alunoB, classB]);
    await mk("enrollments", "student_id, class_id", [alunoPro, classA]);
    teacherA = { userId: tuA };
    teacherB = { userId: tuB };
    coordA = { userId: cu };
    admin = { userId: au };
  });

  const ids = async (actor: { userId: string }, role: any) =>
    (await mon.listVisibleLabStudents({ ...actor, role })).map((s) => s.id);

  it("professor vê só a própria turma; coordenador só a escola; admin todos", async () => {
    expect(await ids(teacherA, "teacher")).toEqual([alunoA]);
    expect(await ids(teacherB, "teacher")).toEqual([alunoB]);
    expect(await ids(coordA, "coordinator")).toEqual([alunoA]);
    expect((await ids(admin, "admin")).sort()).toEqual([alunoA, alunoB].sort());
  });

  it("aluno e perfis desconhecidos não veem ninguém; aluno profissional nunca aparece", async () => {
    expect(await ids(teacherA, "student")).toEqual([]);
    expect(await ids(teacherA, "teacher")).not.toContain(alunoPro);
    expect(await mon.canActorSeeLabStudent({ ...teacherA, role: "teacher" }, alunoB)).toBe(false);
    expect(await mon.canActorSeeLabStudent({ ...teacherA, role: "teacher" }, alunoA)).toBe(true);
  });

  it("filtra por turma", async () => {
    const r = await mon.listVisibleLabStudents({ ...admin, role: "admin" }, { classId: classB });
    expect(r.map((s) => s.id)).toEqual([alunoB]);
  });

  it("sinaliza aluno com muitas tentativas erradas e mostra progresso/habilidades", async () => {
    const act = (await testDb.queryOne<any>(
      `SELECT a.id, a.kind, a.config FROM mission_activities a JOIN missions m ON m.id = a.mission_id WHERE m.sort_order = 1 ORDER BY a.sort_order LIMIT 1`
    ))!;
    for (let i = 0; i < 3; i++) await lab.submitActivity(alunoA, act.id, { nada: true });
    const { students, summary } = await mon.getLabMonitor({ ...teacherA, role: "teacher" });
    expect(students).toHaveLength(1);
    expect(students[0].needsHelp.join(" ")).toMatch(/Muitas tentativas/);
    expect(students[0].lessonsTotal).toBe(30);
    expect(students[0].className).toBe("3º A");
    expect(summary.needingHelp).toBe(1);

    await lab.submitActivity(alunoA, act.id, solve(act.kind, act.config));
    const after = await mon.getLabMonitor({ ...teacherA, role: "teacher" });
    expect(after.students[0].needsHelp.join(" ")).not.toMatch(/Muitas tentativas/);
  });
});
