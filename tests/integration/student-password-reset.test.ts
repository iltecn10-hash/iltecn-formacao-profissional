import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const { resetStudentPassword } = await import("@/modules/students/queries");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}

describe("redefinição de senha de aluno — escopo por perfil", () => {
  let studentA: string, studentB: string, userA: string;
  let teacherA: string, teacherB: string, coordA: string, admin: string, otherStudentUser: string;

  beforeEach(async () => {
    testDb = createTestDb();
    const schoolA = await mk("schools", "name", ["Escola A"]);
    const schoolB = await mk("schools", "name", ["Escola B"]);
    const u = (e: string, role: string) => mk("users", "email, password_hash, name, role", [e, "antigo", e, role]);
    teacherA = await u("ta@x.com", "teacher");
    teacherB = await u("tb@x.com", "teacher");
    coordA = await u("c@x.com", "coordinator");
    admin = await u("ad@x.com", "admin");
    const tA = await mk("teachers", "user_id, school_id", [teacherA, schoolA]);
    const tB = await mk("teachers", "user_id, school_id", [teacherB, schoolB]);
    await mk("coordinators", "user_id, school_id", [coordA, schoolA]);
    const classA = await mk("classes", "school_id, teacher_id, name", [schoolA, tA, "A"]);
    const classB = await mk("classes", "school_id, teacher_id, name", [schoolB, tB, "B"]);
    userA = await u("a@x.com", "student");
    otherStudentUser = await u("b@x.com", "student");
    studentA = await mk("students", "user_id, school_id", [userA, schoolA]);
    studentB = await mk("students", "user_id, school_id", [otherStudentUser, schoolB]);
    await mk("enrollments", "student_id, class_id", [studentA, classA]);
    await mk("enrollments", "student_id, class_id", [studentB, classB]);
  });

  const hashOf = async (id: string) =>
    (await testDb.queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [id]))!.password_hash;

  it("admin redefine qualquer aluno e a nova senha passa no bcrypt", async () => {
    const r = await resetStudentPassword({ userId: admin, role: "admin" }, studentB, "novaSenha1");
    expect(r?.email).toBe("b@x.com");
    expect(await bcrypt.compare("novaSenha1", await hashOf(otherStudentUser))).toBe(true);
  });

  it("professor só redefine alunos das suas turmas", async () => {
    expect(await resetStudentPassword({ userId: teacherA, role: "teacher" }, studentA, "abc12345")).not.toBeNull();
    expect(await resetStudentPassword({ userId: teacherA, role: "teacher" }, studentB, "abc12345")).toBeNull();
    expect(await hashOf(otherStudentUser)).toBe("antigo");
  });

  it("coordenador só redefine alunos da própria escola", async () => {
    expect(await resetStudentPassword({ userId: coordA, role: "coordinator" }, studentA, "abc12345")).not.toBeNull();
    expect(await resetStudentPassword({ userId: coordA, role: "coordinator" }, studentB, "abc12345")).toBeNull();
  });

  it("aluno não redefine ninguém, e aluno inexistente devolve null", async () => {
    expect(await resetStudentPassword({ userId: userA, role: "student" }, studentB, "abc12345")).toBeNull();
    expect(
      await resetStudentPassword({ userId: admin, role: "admin" }, "99999999-9999-4999-8999-999999999999", "abc12345")
    ).toBeNull();
    expect(await hashOf(otherStudentUser)).toBe("antigo");
  });
});
