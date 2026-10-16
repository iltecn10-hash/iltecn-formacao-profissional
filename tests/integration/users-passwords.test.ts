import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const { listManagedUsers, resetUserPassword, changeOwnPassword } = await import("@/modules/users/queries");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}

describe("acessos e senhas — escopo e troca", () => {
  const id: Record<string, string> = {};

  beforeEach(async () => {
    testDb = createTestDb();
    const hash = bcrypt.hashSync("Antiga123", 4);
    const u = async (key: string, role: string) => {
      id[key] = await mk("users", "email, password_hash, name, role", [`${key}@x.com`, hash, key, role]);
    };
    const schoolA = await mk("schools", "name", ["A"]);
    const schoolB = await mk("schools", "name", ["B"]);
    for (const [k, r] of [
      ["admin", "admin"], ["coordA", "coordinator"], ["coordB", "coordinator"],
      ["teachA", "teacher"], ["teachB", "teacher"], ["teachA2", "teacher"],
      ["stuA", "student"], ["stuA2", "student"], ["stuB", "student"],
    ]) await u(k, r);
    await mk("coordinators", "user_id, school_id", [id.coordA, schoolA]);
    await mk("coordinators", "user_id, school_id", [id.coordB, schoolB]);
    const tA = await mk("teachers", "user_id, school_id", [id.teachA, schoolA]);
    const tB = await mk("teachers", "user_id, school_id", [id.teachB, schoolB]);
    await mk("teachers", "user_id, school_id", [id.teachA2, schoolA]);
    const clA = await mk("classes", "school_id, teacher_id, name", [schoolA, tA, "A"]);
    const clB = await mk("classes", "school_id, teacher_id, name", [schoolB, tB, "B"]);
    const sA = await mk("students", "user_id, school_id", [id.stuA, schoolA]);
    await mk("students", "user_id, school_id", [id.stuA2, schoolA]); // da escola A, sem turma
    const sB = await mk("students", "user_id, school_id", [id.stuB, schoolB]);
    await mk("enrollments", "student_id, class_id", [sA, clA]);
    await mk("enrollments", "student_id, class_id", [sB, clB]);
  });

  const emails = async (actor: Parameters<typeof listManagedUsers>[0]) =>
    (await listManagedUsers(actor)).map((x) => x.email).sort();
  const hashOf = async (uid: string) =>
    (await testDb.queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [uid]))!.password_hash;

  it("admin vê todas as contas", async () => {
    expect((await emails({ userId: id.admin, role: "admin" })).length).toBe(9);
  });

  it("coordenador vê só professores e alunos da própria escola (nunca admin/coordenação)", async () => {
    expect(await emails({ userId: id.coordA, role: "coordinator" })).toEqual(
      ["stuA@x.com", "stuA2@x.com", "teachA2@x.com", "teachA@x.com"].sort()
    );
  });

  it("professor vê só alunos matriculados nas suas turmas", async () => {
    expect(await emails({ userId: id.teachA, role: "teacher" })).toEqual(["stuA@x.com"]);
    expect(await emails({ userId: id.teachA2, role: "teacher" })).toEqual([]);
  });

  it("aluno não vê ninguém", async () => {
    expect(await listManagedUsers({ userId: id.stuA, role: "student" })).toEqual([]);
  });

  it("redefinição respeita o escopo e a nova senha passa no bcrypt", async () => {
    const r = await resetUserPassword({ userId: id.coordA, role: "coordinator" }, id.teachA, "Provisoria9");
    expect(r?.email).toBe("teachA@x.com");
    expect(bcrypt.compareSync("Provisoria9", await hashOf(id.teachA))).toBe(true);

    // fora do escopo: outra escola, admin e a própria coordenação
    for (const target of [id.teachB, id.stuB, id.admin, id.coordB]) {
      expect(await resetUserPassword({ userId: id.coordA, role: "coordinator" }, target, "x12345678")).toBeNull();
    }
    // professor só aluno da turma dele
    expect(await resetUserPassword({ userId: id.teachA, role: "teacher" }, id.stuA2, "x12345678")).toBeNull();
    expect(await resetUserPassword({ userId: id.teachA, role: "teacher" }, id.stuA, "Aluno1234")).not.toBeNull();
    expect(await resetUserPassword({ userId: id.stuA, role: "student" }, id.stuA2, "x12345678")).toBeNull();
    // admin redefine qualquer um
    expect(await resetUserPassword({ userId: id.admin, role: "admin" }, id.coordB, "Coord12345")).not.toBeNull();
    expect(bcrypt.compareSync("Antiga123", await hashOf(id.stuB))).toBe(true); // intacto
  });

  it("troca da própria senha exige a atual", async () => {
    expect(await changeOwnPassword(id.stuA, "errada", "Nova12345")).toBe("wrong_current");
    expect(await changeOwnPassword(id.stuA, "Antiga123", "Antiga123")).toBe("same_password");
    expect(await changeOwnPassword(id.stuA, "Antiga123", "Nova12345")).toBe("ok");
    expect(bcrypt.compareSync("Nova12345", await hashOf(id.stuA))).toBe(true);
    expect(await changeOwnPassword(id.stuA, "Antiga123", "Outra12345")).toBe("wrong_current");
  });

  it("conta desativada não troca senha", async () => {
    await testDb.query(`UPDATE users SET active = false WHERE id = $1`, [id.stuA]);
    expect(await changeOwnPassword(id.stuA, "Antiga123", "Nova12345")).toBe("not_found");
  });
});
