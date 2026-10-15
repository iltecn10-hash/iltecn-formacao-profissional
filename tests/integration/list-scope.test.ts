import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";
import type { UserRole } from "@/types";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const { listStudents } = await import("@/modules/students/queries");
const { listTeachers } = await import("@/modules/teachers/queries");
const { listClasses, teacherBelongsToSchool } = await import("@/modules/classes/queries");
const { canActorUseSchool, getActorSchoolId } = await import("@/modules/schools/scope");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
const user = (name: string, role: string) =>
  mk("users", "email, password_hash, name, role", [`${name}@x.com`, "h", name, role]);

describe("listagens da equipe — isolamento por escola (Etapa 0)", () => {
  let schoolA: string, schoolB: string;
  let tA: string, tB: string;
  let actors: Record<string, { userId: string; role: UserRole }>;

  beforeEach(async () => {
    testDb = createTestDb();
    schoolA = await mk("schools", "name", ["Escola A"]);
    schoolB = await mk("schools", "name", ["Escola B"]);
    const profA = await user("profa", "teacher");
    const profB = await user("profb", "teacher");
    const coordA = await user("coorda", "coordinator");
    const coordSem = await user("coordsem", "coordinator");
    const adm = await user("adm", "admin");
    const alu = await user("aluno", "student");
    tA = await mk("teachers", "user_id, school_id", [profA, schoolA]);
    tB = await mk("teachers", "user_id, school_id", [profB, schoolB]);
    await mk("coordinators", "user_id, school_id", [coordA, schoolA]);
    await testDb.query(`INSERT INTO coordinators (user_id) VALUES ($1)`, [coordSem]); // sem escola
    await mk("students", "user_id, school_id", [alu, schoolA]);
    const b = await user("alunob", "student");
    await mk("students", "user_id, school_id", [b, schoolB]);
    await mk("classes", "school_id, teacher_id, name", [schoolA, tA, "Turma A"]);
    await mk("classes", "school_id, teacher_id, name", [schoolB, tB, "Turma B"]);
    actors = {
      profA: { userId: profA, role: "teacher" },
      profB: { userId: profB, role: "teacher" },
      coordA: { userId: coordA, role: "coordinator" },
      coordSem: { userId: coordSem, role: "coordinator" },
      adm: { userId: adm, role: "admin" },
      aluno: { userId: alu, role: "student" },
    };
  });

  it("admin vê tudo", async () => {
    expect((await listStudents(actors.adm)).length).toBe(2);
    expect((await listTeachers(actors.adm)).length).toBe(2);
    expect((await listClasses(actors.adm)).length).toBe(2);
  });

  it("professor e coordenador só veem a própria escola", async () => {
    for (const a of [actors.profA, actors.coordA]) {
      const st = await listStudents(a);
      expect(st.map((s) => s.school_id)).toEqual([schoolA]);
      expect((await listTeachers(a)).map((t) => t.school_id)).toEqual([schoolA]);
      expect((await listClasses(a)).map((c) => c.name)).toEqual(["Turma A"]);
    }
    expect((await listClasses(actors.profB)).map((c) => c.name)).toEqual(["Turma B"]);
  });

  it("coordenador sem escola e aluno não veem nada", async () => {
    for (const a of [actors.coordSem, actors.aluno]) {
      expect(await listStudents(a)).toEqual([]);
      expect(await listTeachers(a)).toEqual([]);
      expect(await listClasses(a)).toEqual([]);
    }
  });

  it("canActorUseSchool: admin qualquer; professor só a própria; demais nunca", async () => {
    expect(await canActorUseSchool(actors.adm, schoolB)).toBe(true);
    expect(await canActorUseSchool(actors.profA, schoolA)).toBe(true);
    expect(await canActorUseSchool(actors.profA, schoolB)).toBe(false);
    expect(await canActorUseSchool(actors.coordA, schoolA)).toBe(false);
    expect(await canActorUseSchool(actors.aluno, schoolA)).toBe(false);
    expect(await getActorSchoolId(actors.coordSem)).toBeNull();
  });

  it("teacherBelongsToSchool confere o vínculo professor↔escola", async () => {
    expect(await teacherBelongsToSchool(tA, schoolA)).toBe(true);
    expect(await teacherBelongsToSchool(tA, schoolB)).toBe(false);
  });
});
