import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const E = await import("@/modules/classes/enrollments");
const A = await import("@/modules/assignments/queries");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}

describe("matrícula de alunos na turma", () => {
  const id: Record<string, string> = {};
  const as = (k: string, role: "admin" | "teacher" | "coordinator" | "student") => ({ userId: id[k], role });

  beforeEach(async () => {
    testDb = createTestDb();
    const hash = bcrypt.hashSync("x", 4);
    for (const [k, r] of [
      ["admin", "admin"], ["teachA", "teacher"], ["teachA2", "teacher"], ["teachB", "teacher"],
      ["coordA", "coordinator"], ["coordB", "coordinator"], ["stuA", "student"], ["stuB", "student"],
    ]) id[k] = await mk("users", "email, password_hash, name, role", [`${k}@x.com`, hash, k, r]);
    id.schoolA = await mk("schools", "name", ["A"]);
    id.schoolB = await mk("schools", "name", ["B"]);
    await mk("coordinators", "user_id, school_id", [id.coordA, id.schoolA]);
    await mk("coordinators", "user_id, school_id", [id.coordB, id.schoolB]);
    id.tA = await mk("teachers", "user_id, school_id", [id.teachA, id.schoolA]);
    id.tA2 = await mk("teachers", "user_id, school_id", [id.teachA2, id.schoolA]);
    id.tB = await mk("teachers", "user_id, school_id", [id.teachB, id.schoolB]);
    id.classA = await mk("classes", "school_id, teacher_id, name", [id.schoolA, id.tA, "Turma A"]);
    id.classB = await mk("classes", "school_id, teacher_id, name", [id.schoolB, id.tB, "Turma B"]);
    id.sA = await mk("students", "user_id, school_id", [id.stuA, id.schoolA]);
    id.sB = await mk("students", "user_id, school_id", [id.stuB, id.schoolB]);
  });

  it("matricula, lista e o aluno passa a ver a atividade da turma; remover tira e reativar volta", async () => {
    const aid = (await A.createAssignment(as("teachA", "teacher"), { classId: id.classA, title: "Atividade" }, [])).id;
    expect(await A.listAssignmentsForStudent(id.stuA)).toHaveLength(0);

    await E.enrollInClass(as("teachA", "teacher"), id.classA, id.sA);
    await E.enrollInClass(as("teachA", "teacher"), id.classA, id.sA); // duas vezes não duplica
    const roster = await E.getClassRoster(as("teachA", "teacher"), id.classA);
    expect(roster.enrolled.map((p) => p.student_id)).toEqual([id.sA]);
    expect(roster.available).toHaveLength(0);
    expect((await A.listAssignmentsForStudent(id.stuA)).map((a) => a.id)).toEqual([aid]);

    await E.unenrollFromClass(as("teachA", "teacher"), id.classA, id.sA);
    expect(await A.listAssignmentsForStudent(id.stuA)).toHaveLength(0);
    expect((await E.getClassRoster(as("teachA", "teacher"), id.classA)).available.map((p) => p.student_id)).toEqual([id.sA]);

    await E.enrollInClass(as("admin", "admin"), id.classA, id.sA);
    expect(await A.listAssignmentsForStudent(id.stuA)).toHaveLength(1);
  });

  it("só admin, coordenação da escola e professor responsável; aluno de outra escola é recusado", async () => {
    await expect(E.enrollInClass(as("teachA2", "teacher"), id.classA, id.sA)).rejects.toMatchObject({ status: 403 });
    await expect(E.enrollInClass(as("teachB", "teacher"), id.classA, id.sA)).rejects.toMatchObject({ status: 403 });
    await expect(E.enrollInClass(as("coordB", "coordinator"), id.classA, id.sA)).rejects.toMatchObject({ status: 403 });
    await expect(E.enrollInClass(as("stuA", "student"), id.classA, id.sA)).rejects.toMatchObject({ status: 403 });
    await expect(E.getClassRoster(as("teachB", "teacher"), id.classA)).rejects.toMatchObject({ status: 403 });
    await expect(E.enrollInClass(as("admin", "admin"), id.classA, id.sB)).rejects.toMatchObject({ status: 400 });
    await expect(E.enrollInClass(as("coordA", "coordinator"), id.classA, id.sA)).resolves.toBeUndefined();
  });

  it("recusa turma desativada e aluno desativado", async () => {
    await testDb.query(`UPDATE users SET active = false WHERE id = $1`, [id.stuA]);
    await expect(E.enrollInClass(as("admin", "admin"), id.classA, id.sA)).rejects.toMatchObject({ status: 409 });
    await testDb.query(`UPDATE users SET active = true WHERE id = $1`, [id.stuA]);
    await testDb.query(`UPDATE classes SET active = false WHERE id = $1`, [id.classA]);
    await expect(E.enrollInClass(as("admin", "admin"), id.classA, id.sA)).rejects.toMatchObject({ status: 409 });
  });
});
