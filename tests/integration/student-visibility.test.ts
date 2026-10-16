import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";
import type { UserRole } from "@/types";

let testDb: ReturnType<typeof createTestDb>;
vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const access = await import("@/modules/students/access");
const works = await import("@/modules/student-works/queries");
const reports = await import("@/modules/reports/queries");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
const user = (n: string, role: string) => mk("users", "email, password_hash, name, role", [`${n}@x.com`, "h", n, role]);
type Actor = { userId: string; role: UserRole };

describe("escopo de alunos para a equipe (trabalhos e relatórios)", () => {
  let sA: string, sB: string;
  let stRes: string, stSub: string, stOut: string, stInactive: string, stB: string;
  let prof: Actor, profSub: Actor, profNone: Actor, profB: Actor, coordA: Actor, coordB: Actor, adm: Actor, aluno: Actor;
  const mission = { id: "" };

  beforeEach(async () => {
    testDb = createTestDb();
    sA = await mk("schools", "name", ["Escola A"]);
    sB = await mk("schools", "name", ["Escola B"]);
    const u = await Promise.all(["prof", "sub", "none", "profb", "coorda", "coordb", "adm", "aluno"].map((n, i) =>
      user(n, ["teacher", "teacher", "teacher", "teacher", "coordinator", "coordinator", "admin", "student"][i])));
    const tRes = await mk("teachers", "user_id, school_id", [u[0], sA]);
    const tSub = await mk("teachers", "user_id, school_id", [u[1], sA]);
    await mk("teachers", "user_id, school_id", [u[2], sA]);
    const tB = await mk("teachers", "user_id, school_id", [u[3], sB]);
    await mk("coordinators", "user_id, school_id", [u[4], sA]);
    await mk("coordinators", "user_id, school_id", [u[5], sB]);
    const clsA = await mk("classes", "school_id, teacher_id, name", [sA, tRes, "6º A"]);
    const clsA2 = await mk("classes", "school_id, teacher_id, name", [sA, tRes, "7º A"]);
    const clsB = await mk("classes", "school_id, teacher_id, name", [sB, tB, "6º B"]);
    const enroll = async (n: string, school: string, klass: string | null, status = "active") => {
      const id = await mk("students", "user_id, school_id", [await user("al-" + n, "student"), school]);
      if (klass) await testDb.query(`INSERT INTO enrollments (student_id, class_id, status) VALUES ($1,$2,$3)`, [id, klass, status]);
      return id;
    };
    stRes = await enroll("res", sA, clsA);          // turma pela qual prof é responsável
    stSub = await enroll("sub", sA, clsA2);         // turma onde profSub leciona uma disciplina
    stOut = await enroll("fora", sA, null);         // da escola A, sem turma
    stInactive = await enroll("inativo", sA, clsA, "inactive");
    stB = await enroll("b", sB, clsB);
    const subj = await mk("subjects", "school_id, name, name_key", [sA, "Matemática", "matemática"]);
    await testDb.query(`INSERT INTO class_subject_teachers (class_id, subject_id, teacher_id) VALUES ($1,$2,$3)`, [clsA2, subj, tSub]);
    prof = { userId: u[0], role: "teacher" }; profSub = { userId: u[1], role: "teacher" };
    profNone = { userId: u[2], role: "teacher" }; profB = { userId: u[3], role: "teacher" };
    coordA = { userId: u[4], role: "coordinator" }; coordB = { userId: u[5], role: "coordinator" };
    adm = { userId: u[6], role: "admin" }; aluno = { userId: u[7], role: "student" };
    const trk = await mk("tracks", "name, slug", ["Trilha", "trilha"]);
    const mod = await mk("modules", "track_id, name", [trk, "Módulo"]);
    mission.id = await mk("missions", "module_id, title", [mod, "Missão"]);
    for (const st of [stRes, stSub, stOut, stB])
      await testDb.query(`INSERT INTO student_works (student_id, mission_id, work_type, title) VALUES ($1,$2,'DOCUMENT','T')`, [st, mission.id]);
  });

  const can = (a: Actor, s: string) => access.canActorViewStudent(a, s);

  it("professor: alunos das turmas que coordena OU onde tem vínculo ativo; ninguém além", async () => {
    expect(await can(prof, stRes)).toBe(true);
    expect(await can(prof, stSub)).toBe(true);       // responsável também pela 7º A
    expect(await can(prof, stOut)).toBe(false);      // mesma escola, mas sem turma dele
    expect(await can(prof, stInactive)).toBe(false); // matrícula inativa
    expect(await can(prof, stB)).toBe(false);        // outra escola
    expect(await can(profSub, stSub)).toBe(true);    // vínculo de disciplina
    expect(await can(profSub, stRes)).toBe(false);
    expect(await can(profNone, stRes)).toBe(false);
    expect(await can(profB, stRes)).toBe(false);
  });

  it("coordenador: a escola inteira; admin: todos; aluno: nada", async () => {
    for (const s of [stRes, stSub, stOut, stInactive]) expect(await can(coordA, s)).toBe(true);
    expect(await can(coordA, stB)).toBe(false);
    expect(await can(coordB, stRes)).toBe(false);
    expect(await can(coordB, stB)).toBe(true);
    for (const s of [stRes, stOut, stB]) expect(await can(adm, s)).toBe(true);
    expect(await can(aluno, stRes)).toBe(false);
  });

  it("listStudentWorksForStaff devolve só os trabalhos do escopo", async () => {
    const names = async (a: Actor) => (await works.listStudentWorksForStaff(a, {})).map((w) => String(w.student_name).replace(/^al-/, "")).sort();
    expect(await names(prof)).toEqual(["res", "sub"]);
    expect(await names(profSub)).toEqual(["sub"]);
    expect(await names(coordA)).toEqual(["fora", "res", "sub"]);
    expect(await names(coordB)).toEqual(["b"]);
    expect(await names(adm)).toEqual(["b", "fora", "res", "sub"]);
    expect(await names(profNone)).toEqual([]);
    expect(await names(aluno)).toEqual([]);
  });

  it("filtro por studentId não fura o escopo", async () => {
    expect(await works.listStudentWorksForStaff(profB, { studentId: stRes })).toEqual([]);
    expect(await works.listStudentWorksForStaff(prof, { studentId: stRes })).toHaveLength(1);
  });

  it("getModulePerformance só considera os alunos do escopo", async () => {
    await testDb.query(`INSERT INTO mission_attempts (student_id, mission_id, status) VALUES ($1,$2,'concluida')`, [stRes, mission.id]);
    await testDb.query(`INSERT INTO mission_attempts (student_id, mission_id, status) VALUES ($1,$2,'concluida')`, [stB, mission.id]);
    const rate = async (a: Actor) => (await reports.getModulePerformance(a))[0]?.completion_rate;
    expect(Number(await rate(coordA))).toBe(25); // 1 de 4 alunos da escola A
    expect(Number(await rate(coordB))).toBe(100);                  // 1 de 1 da escola B
    expect(await reports.getModulePerformance(aluno)).toEqual([]);
  });

  it("countWorksAwaitingReview conta só trabalhos ENTREGUES do escopo", async () => {
    await testDb.query(`UPDATE student_works SET status = 'SUBMITTED' WHERE student_id IN ($1,$2,$3)`, [stRes, stOut, stB]);
    expect(await works.countWorksAwaitingReview(prof)).toBe(1);   // só stRes
    expect(await works.countWorksAwaitingReview(coordA)).toBe(2); // stRes + stOut
    expect(await works.countWorksAwaitingReview(adm)).toBe(3);
    expect(await works.countWorksAwaitingReview(aluno)).toBe(0);
  });
});
