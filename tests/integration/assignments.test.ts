import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const A = await import("@/modules/assignments/queries");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
const file = (name: string, text = "conteudo") => ({ name, mime: "text/plain", size: text.length, data: Buffer.from(text) });

describe("atividades da turma", () => {
  const id: Record<string, string> = {};
  const as = (k: string, role: "admin" | "teacher" | "coordinator" | "student") => ({ userId: id[k], role });

  beforeEach(async () => {
    testDb = createTestDb();
    const hash = bcrypt.hashSync("x", 4);
    for (const [k, r] of [
      ["admin", "admin"], ["teachA", "teacher"], ["teachB", "teacher"], ["coordA", "coordinator"], ["coordB", "coordinator"],
      ["stuA", "student"], ["stuA2", "student"], ["stuB", "student"],
    ]) id[k] = await mk("users", "email, password_hash, name, role", [`${k}@x.com`, hash, k, r]);
    id.schoolA = await mk("schools", "name", ["A"]);
    id.schoolB = await mk("schools", "name", ["B"]);
    await mk("coordinators", "user_id, school_id", [id.coordA, id.schoolA]);
    await mk("coordinators", "user_id, school_id", [id.coordB, id.schoolB]);
    id.tA = await mk("teachers", "user_id, school_id", [id.teachA, id.schoolA]);
    id.tB = await mk("teachers", "user_id, school_id", [id.teachB, id.schoolB]);
    id.classA = await mk("classes", "school_id, teacher_id, name", [id.schoolA, id.tA, "Turma A"]);
    id.classB = await mk("classes", "school_id, teacher_id, name", [id.schoolB, id.tB, "Turma B"]);
    id.sA = await mk("students", "user_id, school_id", [id.stuA, id.schoolA]);
    id.sA2 = await mk("students", "user_id, school_id", [id.stuA2, id.schoolA]);
    id.sB = await mk("students", "user_id, school_id", [id.stuB, id.schoolB]);
    await mk("enrollments", "student_id, class_id", [id.sA, id.classA]);
    await mk("enrollments", "student_id, class_id", [id.sA2, id.classA]);
    await mk("enrollments", "student_id, class_id", [id.sB, id.classB]);
  });

  async function create(title = "Atividade 1") {
    return (await A.createAssignment(as("teachA", "teacher"), { classId: id.classA, title, dueDate: "2099-01-01" }, [file("material.txt")])).id;
  }

  it("professor cria só para a própria turma; admin para qualquer; aluno e coordenador não", async () => {
    await expect(A.createAssignment(as("teachA", "teacher"), { classId: id.classB, title: "x" }, [])).rejects.toMatchObject({ status: 403 });
    await expect(A.createAssignment(as("stuA", "student"), { classId: id.classA, title: "x" }, [])).rejects.toMatchObject({ status: 403 });
    await expect(A.createAssignment(as("coordA", "coordinator"), { classId: id.classA, title: "x" }, [])).rejects.toMatchObject({ status: 403 });
    await expect(A.createAssignment(as("admin", "admin"), { classId: id.classB, title: "ok" }, [])).resolves.toBeTruthy();
  });

  it("listagens respeitam o escopo (professor, coordenador, aluno)", async () => {
    await create();
    expect(await A.listAssignmentsForStaff(as("teachA", "teacher"))).toHaveLength(1);
    expect(await A.listAssignmentsForStaff(as("teachB", "teacher"))).toHaveLength(0);
    expect(await A.listAssignmentsForStaff(as("coordA", "coordinator"))).toHaveLength(1);
    expect(await A.listAssignmentsForStaff(as("coordB", "coordinator"))).toHaveLength(0);
    expect(await A.listAssignmentsForStudent(id.stuA)).toHaveLength(1);
    expect(await A.listAssignmentsForStudent(id.stuB)).toHaveLength(0);
    const sum = (await A.listAssignmentsForStaff(as("teachA", "teacher")))[0];
    expect({ total: sum.total_students, delivered: sum.delivered }).toEqual({ total: 2, delivered: 0 });
  });

  it("acesso à atividade: aluno de outra turma e professor de outra escola não veem", async () => {
    const a = await create();
    expect(await A.getAssignmentAccess(as("stuA", "student"), a)).toMatchObject({ level: "student" });
    expect(await A.getAssignmentAccess(as("stuB", "student"), a)).toBeNull();
    expect(await A.getAssignmentAccess(as("teachB", "teacher"), a)).toBeNull();
    expect(await A.getAssignmentAccess(as("coordA", "coordinator"), a)).toMatchObject({ level: "view" });
  });

  it("aluno entrega, reenvia (substitui) e a equipe vê os arquivos", async () => {
    const a = await create();
    await expect(A.submitAssignment(as("stuA", "student"), a, null, [])).rejects.toMatchObject({ status: 400 });
    await A.submitAssignment(as("stuA", "student"), a, "segue", [file("trab.txt", "v1")]);
    await A.submitAssignment(as("stuA", "student"), a, "novo", [file("trab2.txt", "v2")]);
    const acc = (await A.getAssignmentAccess(as("teachA", "teacher"), a))!;
    const subs = await A.listSubmissions(acc.assignment);
    expect(subs).toHaveLength(1);
    expect(subs[0].files.map((f) => f.file_name)).toEqual(["trab2.txt"]);
    expect(subs[0].comment).toBe("novo");
    expect((await A.listPendingStudents(acc.assignment)).map((s) => s.id)).toEqual([id.sA2]);
    // aluno de outra turma não entrega
    await expect(A.submitAssignment(as("stuB", "student"), a, null, [file("x.txt")])).rejects.toMatchObject({ status: 404 });
  });

  it("avaliação: só quem gerencia; nota limitada; avaliada trava reenvio; devolver reabre", async () => {
    const a = await create();
    const { id: sub } = await A.submitAssignment(as("stuA", "student"), a, null, [file("t.txt")]);
    await expect(A.evaluateSubmission(as("coordA", "coordinator"), sub, { status: "evaluated", score: 8 })).rejects.toMatchObject({ status: 403 });
    await expect(A.evaluateSubmission(as("teachB", "teacher"), sub, { status: "evaluated", score: 8 })).rejects.toMatchObject({ status: 404 });
    await expect(A.evaluateSubmission(as("teachA", "teacher"), sub, { status: "evaluated", score: 11 })).rejects.toMatchObject({ status: 400 });
    await A.evaluateSubmission(as("teachA", "teacher"), sub, { status: "evaluated", score: 8.5, feedback: "bom" });
    await expect(A.submitAssignment(as("stuA", "student"), a, null, [file("t2.txt")])).rejects.toMatchObject({ status: 409 });
    await A.evaluateSubmission(as("teachA", "teacher"), sub, { status: "returned", feedback: "refaça" });
    await expect(A.submitAssignment(as("stuA", "student"), a, null, [file("t2.txt")])).resolves.toBeTruthy();
  });

  it("atividade encerrada não recebe entrega; excluir com entrega só encerra", async () => {
    const a = await create();
    await A.submitAssignment(as("stuA", "student"), a, null, [file("t.txt")]);
    expect(await A.deleteAssignment(as("teachA", "teacher"), a)).toBe("deactivated");
    await expect(A.submitAssignment(as("stuA2", "student"), a, null, [file("t.txt")])).rejects.toMatchObject({ status: 409 });
    const b = await create("Sem entregas");
    expect(await A.deleteAssignment(as("teachA", "teacher"), b)).toBe("deleted");
  });

  it("download: material para a turma; entrega só do dono e da equipe", async () => {
    const a = await create();
    await A.submitAssignment(as("stuA", "student"), a, null, [file("t.txt", "meu")]);
    const files = await testDb.query<{ id: string; kind: string }>(`SELECT id, kind FROM assignment_files WHERE assignment_id = $1`, [a]);
    const mat = files.find((f) => f.kind === "material")!.id;
    const del = files.find((f) => f.kind === "delivery")!.id;
    expect(await A.getFileForDownload(as("stuA2", "student"), mat)).toMatchObject({ file_name: "material.txt" });
    expect(await A.getFileForDownload(as("stuB", "student"), mat)).toBeNull();
    expect((await A.getFileForDownload(as("stuA", "student"), del))?.data.toString()).toBe("meu");
    expect(await A.getFileForDownload(as("stuA2", "student"), del)).toBeNull();
    expect(await A.getFileForDownload(as("teachA", "teacher"), del)).not.toBeNull();
    expect(await A.getFileForDownload(as("coordA", "coordinator"), del)).not.toBeNull();
    expect(await A.getFileForDownload(as("teachB", "teacher"), del)).toBeNull();
    expect(await A.getFileForDownload(as("coordB", "coordinator"), del)).toBeNull();
  });
});

describe("arquivos na ficha do aluno", () => {
  it("lista só as entregas que o ator pode ver", async () => {
    testDb = createTestDb();
    const hash = bcrypt.hashSync("x", 4);
    const u = async (k: string, role: string) => (await mk("users", "email, password_hash, name, role", [`${k}@y.com`, hash, k, role]));
    const tA = await u("tA", "teacher"); const tB = await u("tB", "teacher"); const st = await u("st", "student"); const co = await u("co", "coordinator");
    const school = await mk("schools", "name", ["S"]);
    const school2 = await mk("schools", "name", ["S2"]);
    await mk("coordinators", "user_id, school_id", [co, school2]);
    const teachA = await mk("teachers", "user_id, school_id", [tA, school]);
    const teachB = await mk("teachers", "user_id, school_id", [tB, school]);
    const cls = await mk("classes", "school_id, teacher_id, name", [school, teachA, "C1"]);
    const cls2 = await mk("classes", "school_id, teacher_id, name", [school, teachB, "C2"]);
    const sid = await mk("students", "user_id, school_id", [st, school]);
    await mk("enrollments", "student_id, class_id", [sid, cls]);
    await mk("enrollments", "student_id, class_id", [sid, cls2]);
    const a1 = (await A.createAssignment({ userId: tA, role: "teacher" }, { classId: cls, title: "Da A" }, [])).id;
    const a2 = (await A.createAssignment({ userId: tB, role: "teacher" }, { classId: cls2, title: "Da B" }, [])).id;
    await A.submitAssignment({ userId: st, role: "student" }, a1, null, [file("a.txt")]);
    await A.submitAssignment({ userId: st, role: "student" }, a2, null, [file("b.txt")]);
    expect((await A.listDeliveriesForStudent({ userId: tA, role: "teacher" }, sid)).map((d) => d.assignment_title)).toEqual(["Da A"]);
    expect(await A.listDeliveriesForStudent({ userId: "00000000-0000-4000-8000-000000000000", role: "admin" }, sid)).toHaveLength(2);
    expect(await A.listDeliveriesForStudent({ userId: co, role: "coordinator" }, sid)).toHaveLength(0);
  });
});
