import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const C = await import("@/modules/coordination/queries");
const R = await import("@/modules/registry/records");
const S = await import("@/modules/schools/scope");

const admin = { userId: "", role: "admin" as const };

describe("coordenação e direção", () => {
  let schoolA: string;
  let schoolB: string;

  beforeEach(async () => {
    testDb = createTestDb();
    const a = await testDb.queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, role) VALUES ('adm@x.com', $1, 'Adm', 'admin') RETURNING id`,
      [bcrypt.hashSync("x", 4)]
    );
    admin.userId = a!.id;
    schoolA = (await testDb.queryOne<{ id: string }>(`INSERT INTO schools (name) VALUES ('A') RETURNING id`))!.id;
    schoolB = (await testDb.queryOne<{ id: string }>(`INSERT INTO schools (name) VALUES ('B') RETURNING id`))!.id;
  });

  it("cria diretor e coordenador com perfil coordinator e cargo próprio", async () => {
    const d = await C.createCoordinationMember({ name: "Dir", email: "Dir@X.com", password: "Diretor7x9", schoolId: schoolA, position: "diretor" });
    await C.createCoordinationMember({ name: "Coo", email: "coo@x.com", password: "Diretor7x9", schoolId: schoolA, position: "coordenador" });
    const list = await C.listCoordinationMembers();
    expect(list.map((m) => m.position).sort()).toEqual(["coordenador", "diretor"]);
    const user = await testDb.queryOne<{ role: string; email: string }>(`SELECT role, email FROM users WHERE id = $1`, [d.user_id]);
    expect(user).toMatchObject({ role: "coordinator", email: "dir@x.com" });
    expect(await C.getPositionByUserId(d.user_id)).toBe("diretor");
    // mesmo escopo do coordenador: a escola do cadastro
    expect(await S.getActorSchoolId({ userId: d.user_id, role: "coordinator" })).toBe(schoolA);
  });

  it("e-mail repetido é recusado", async () => {
    await C.createCoordinationMember({ name: "A", email: "a@x.com", password: "Diretor7x9", schoolId: schoolA, position: "diretor" });
    await expect(
      C.createCoordinationMember({ name: "B", email: "a@x.com", password: "Diretor7x9", schoolId: schoolA, position: "coordenador" })
    ).rejects.toThrow();
  });

  it("só admin edita, desativa e exclui; edição troca cargo e escola", async () => {
    const m = await C.createCoordinationMember({ name: "A", email: "a@x.com", password: "Diretor7x9", schoolId: schoolA, position: "coordenador" });
    const coordActor = { userId: m.user_id, role: "coordinator" as const };
    await expect(R.updateCoordinator(coordActor, m.id, { name: "X", email: "x@x.com", schoolId: schoolA, position: "diretor" })).rejects.toMatchObject({ status: 403 });
    await expect(R.deleteCoordinator({ userId: "t", role: "teacher" }, m.id)).rejects.toMatchObject({ status: 403 });

    await R.updateCoordinator(admin, m.id, { name: "Novo", email: "novo@x.com", schoolId: schoolB, position: "diretor" });
    const row = (await C.listCoordinationMembers())[0];
    expect(row).toMatchObject({ name: "Novo", email: "novo@x.com", school_id: schoolB, position: "diretor" });

    await R.setCoordinatorActive(admin, m.id, false);
    expect((await C.listCoordinationMembers())[0].active).toBe(false);
    await R.setCoordinatorActive(admin, m.id, true);

    expect(await R.deleteCoordinator(admin, m.id)).toBe("deleted");
    expect(await C.listCoordinationMembers()).toHaveLength(0);
  });

  it("com histórico (mensagem) só desativa", async () => {
    const m = await C.createCoordinationMember({ name: "A", email: "a@x.com", password: "Diretor7x9", schoolId: schoolA, position: "diretor" });
    await testDb.query(`INSERT INTO internal_messages (sender_id, recipient_id) VALUES ($1, $2)`, [m.user_id, admin.userId]);
    expect(await R.deleteCoordinator(admin, m.id)).toBe("deactivated");
    expect((await C.listCoordinationMembers())[0].active).toBe(false);
  });
});
