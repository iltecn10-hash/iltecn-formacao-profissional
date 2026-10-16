import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const R = await import("@/modules/registry/records");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
const one = async (sql: string, p: unknown[]) => testDb.queryOne<Record<string, unknown>>(sql, p);

describe("editar/excluir cadastros — regras e escopo", () => {
  const id: Record<string, string> = {};
  let admin: { userId: string; role: "admin" };
  let coordA: { userId: string; role: "coordinator" };
  let teachA: { userId: string; role: "teacher" };

  beforeEach(async () => {
    testDb = createTestDb();
    const hash = bcrypt.hashSync("x", 4);
    const u = async (k: string, role: string) => {
      id[k] = await mk("users", "email, password_hash, name, role", [`${k.toLowerCase()}@x.com`, hash, k, role]);
    };
    for (const [k, r] of [
      ["admin", "admin"], ["coordA", "coordinator"], ["coordB", "coordinator"],
      ["teachA", "teacher"], ["teachA2", "teacher"], ["teachB", "teacher"],
      ["stuUsed", "student"], ["stuFree", "student"], ["stuB", "student"],
    ]) await u(k, r);
    id.schoolA = await mk("schools", "name", ["A"]);
    id.schoolB = await mk("schools", "name", ["B"]);
    id.schoolEmpty = await mk("schools", "name", ["Vazia"]);
    await mk("coordinators", "user_id, school_id", [id.coordA, id.schoolA]);
    await mk("coordinators", "user_id, school_id", [id.coordB, id.schoolB]);
    id.tA = await mk("teachers", "user_id, school_id", [id.teachA, id.schoolA]);
    id.tA2 = await mk("teachers", "user_id, school_id", [id.teachA2, id.schoolA]);
    id.tB = await mk("teachers", "user_id, school_id", [id.teachB, id.schoolB]);
    id.classUsed = await mk("classes", "school_id, teacher_id, name", [id.schoolA, id.tA, "Usada"]);
    id.classFree = await mk("classes", "school_id, teacher_id, name", [id.schoolA, id.tA2, "Livre"]);
    id.classB = await mk("classes", "school_id, teacher_id, name", [id.schoolB, id.tB, "B"]);
    id.sUsed = await mk("students", "user_id, school_id", [id.stuUsed, id.schoolA]);
    id.sFree = await mk("students", "user_id, school_id", [id.stuFree, id.schoolA]);
    id.sB = await mk("students", "user_id, school_id", [id.stuB, id.schoolB]);
    await mk("enrollments", "student_id, class_id", [id.sUsed, id.classUsed]);
    admin = { userId: id.admin, role: "admin" };
    coordA = { userId: id.coordA, role: "coordinator" };
    teachA = { userId: id.teachA, role: "teacher" };
  });

  // ── Escolas ──
  it("escola: só admin edita; sem uso apaga de vez, com uso desativa e reativa", async () => {
    await expect(R.updateSchool(coordA, id.schoolA, { name: "Novo" })).rejects.toMatchObject({ status: 403 });
    await R.updateSchool(admin, id.schoolA, { name: "Escola Alfa", city: "Belém" });
    expect((await one(`SELECT name, city FROM schools WHERE id = $1`, [id.schoolA]))).toEqual({ name: "Escola Alfa", city: "Belém" });

    await expect(R.deleteSchool(teachA, id.schoolEmpty)).rejects.toMatchObject({ status: 403 });
    expect(await R.deleteSchool(admin, id.schoolEmpty)).toBe("deleted");
    expect(await one(`SELECT id FROM schools WHERE id = $1`, [id.schoolEmpty])).toBeNull();

    expect(await R.deleteSchool(admin, id.schoolA)).toBe("deactivated");
    expect((await one(`SELECT active FROM schools WHERE id = $1`, [id.schoolA]))!.active).toBe(false);
    await R.setSchoolActive(admin, id.schoolA, true);
    expect((await one(`SELECT active FROM schools WHERE id = $1`, [id.schoolA]))!.active).toBe(true);
    await expect(R.deleteSchool(admin, id.schoolEmpty)).rejects.toMatchObject({ status: 404 });
  });

  // ── Professores ──
  it("professor: só admin; e-mail duplicado = 409; sem uso apaga (usuário junto), com turma desativa", async () => {
    await expect(R.updateTeacher(coordA, id.tA, { name: "X", email: "x@x.com" })).rejects.toMatchObject({ status: 403 });
    await R.updateTeacher(admin, id.tA2, { name: "Prof Novo", email: "NOVO@x.com", bio: "bio" });
    expect(await one(`SELECT name, email FROM users WHERE id = $1`, [id.teachA2])).toEqual({ name: "Prof Novo", email: "novo@x.com" });
    await expect(R.updateTeacher(admin, id.tA2, { name: "Prof", email: "teacha@x.com" })).rejects.toMatchObject({ status: 409 });

    // teachA2 tem a turma "Livre" → desativa; sem turma, apaga
    expect(await R.deleteTeacher(admin, id.tA2)).toBe("deactivated");
    expect((await one(`SELECT active FROM users WHERE id = $1`, [id.teachA2]))!.active).toBe(false);
    await R.setTeacherActive(admin, id.tA2, true);
    expect((await one(`SELECT active FROM users WHERE id = $1`, [id.teachA2]))!.active).toBe(true);

    await testDb.query(`UPDATE classes SET teacher_id = NULL WHERE id = $1`, [id.classFree]);
    expect(await R.deleteTeacher(admin, id.tA2)).toBe("deleted");
    expect(await one(`SELECT id FROM users WHERE id = $1`, [id.teachA2])).toBeNull();
    expect(await one(`SELECT id FROM teachers WHERE id = $1`, [id.tA2])).toBeNull();
  });

  // ── Alunos ──
  it("aluno: admin/coordenador/professor da escola editam; só admin/coordenador excluem; escopo por escola", async () => {
    await R.updateStudent(teachA, id.sFree, { name: "Ana", email: "ana@x.com", birthDate: "2012-03-04", guardianName: "Mãe" });
    expect(await one(`SELECT guardian_name FROM students WHERE id = $1`, [id.sFree])).toEqual({ guardian_name: "Mãe" });
    expect((await one(`SELECT email FROM users WHERE id = $1`, [id.stuFree]))!.email).toBe("ana@x.com");

    await expect(R.updateStudent(teachA, id.sB, { name: "Z", email: "z@x.com" })).rejects.toMatchObject({ status: 403 });
    await expect(R.updateStudent(coordA, id.sB, { name: "Z", email: "z@x.com" })).rejects.toMatchObject({ status: 403 });
    await expect(R.deleteStudent(teachA, id.sFree)).rejects.toMatchObject({ status: 403 });
    await expect(R.deleteStudent(coordA, id.sB)).rejects.toMatchObject({ status: 403 });
    await expect(R.updateStudent(admin, id.sFree, { name: "Ana", email: "teacha@x.com" })).rejects.toMatchObject({ status: 409 });

    // com matrícula → desativa e a conta fica inativa; sem histórico → apaga aluno e usuário
    expect(await R.deleteStudent(coordA, id.sUsed)).toBe("deactivated");
    expect((await one(`SELECT active FROM users WHERE id = $1`, [id.stuUsed]))!.active).toBe(false);
    await R.setStudentActive(coordA, id.sUsed, true);
    expect((await one(`SELECT active FROM users WHERE id = $1`, [id.stuUsed]))!.active).toBe(true);

    expect(await R.deleteStudent(coordA, id.sFree)).toBe("deleted");
    expect(await one(`SELECT id FROM students WHERE id = $1`, [id.sFree])).toBeNull();
    expect(await one(`SELECT id FROM users WHERE id = $1`, [id.stuFree])).toBeNull();
  });

  it("aluno com trabalho/nota/mensagem conta como histórico (nunca é apagado)", async () => {
    await mk("internal_messages", "sender_id, recipient_id", [id.stuFree, id.teachA]);
    expect(await R.deleteStudent(admin, id.sFree)).toBe("deactivated");
    expect(await one(`SELECT id FROM students WHERE id = $1`, [id.sFree])).not.toBeNull();
  });

  // ── Turmas ──
  it("turma: professor edita só a própria; coordenador a da escola; professor não passa a turma adiante", async () => {
    await R.updateClass(teachA, id.classUsed, { name: "7º A", shift: "tarde", schoolYear: 2026, teacherId: id.tA });
    expect(await one(`SELECT name, shift FROM classes WHERE id = $1`, [id.classUsed])).toEqual({ name: "7º A", shift: "tarde" });
    await expect(R.updateClass(teachA, id.classFree, { name: "x", schoolYear: 2026 })).rejects.toMatchObject({ status: 403 });
    await expect(R.updateClass(teachA, id.classUsed, { name: "x", schoolYear: 2026, teacherId: id.tA2 })).rejects.toMatchObject({ status: 403 });
    await expect(R.updateClass(coordA, id.classB, { name: "x", schoolYear: 2026 })).rejects.toMatchObject({ status: 403 });
    await expect(R.updateClass(coordA, id.classFree, { name: "x", schoolYear: 2026, teacherId: id.tB })).rejects.toMatchObject({ status: 400 });
    await R.updateClass(coordA, id.classFree, { name: "Livre 2", schoolYear: 2027, teacherId: id.tA });
    expect((await one(`SELECT teacher_id FROM classes WHERE id = $1`, [id.classFree]))!.teacher_id).toBe(id.tA);
  });

  it("turma: excluir é de admin/coordenador; com alunos desativa, vazia apaga", async () => {
    await expect(R.deleteClass(teachA, id.classUsed)).rejects.toMatchObject({ status: 403 });
    await expect(R.deleteClass(coordA, id.classB)).rejects.toMatchObject({ status: 403 });
    expect(await R.deleteClass(coordA, id.classUsed)).toBe("deactivated");
    await R.setClassActive(coordA, id.classUsed, true);
    expect((await one(`SELECT active FROM classes WHERE id = $1`, [id.classUsed]))!.active).toBe(true);
    expect(await R.deleteClass(coordA, id.classFree)).toBe("deleted");
    expect(await one(`SELECT id FROM classes WHERE id = $1`, [id.classFree])).toBeNull();
  });

  it("papéis sem permissão (aluno) nunca chegam a alterar nada", async () => {
    const stu = { userId: id.stuUsed, role: "student" as const };
    await expect(R.deleteSchool(stu, id.schoolA)).rejects.toMatchObject({ status: 403 });
    await expect(R.deleteStudent(stu, id.sFree)).rejects.toMatchObject({ status: 403 });
    await expect(R.deleteClass(stu, id.classFree)).rejects.toMatchObject({ status: 403 });
    await expect(R.updateStudent(stu, id.sFree, { name: "a", email: "a@x.com" })).rejects.toMatchObject({ status: 403 });
  });
});
