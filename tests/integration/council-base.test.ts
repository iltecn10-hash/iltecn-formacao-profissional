import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";
import type { UserRole } from "@/types";

let testDb: ReturnType<typeof createTestDb>;
vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const q = await import("@/modules/council/queries");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
const user = (n: string, role: string) => mk("users", "email, password_hash, name, role", [`${n}@x.com`, "h", n, role]);
type Actor = { userId: string; role: UserRole };

describe("Conselho de Classe — cadastros base", () => {
  let sA: string, sB: string, tA: string, tA2: string, tB: string, clsA: string, clsA2: string, clsB: string;
  let adm: Actor, coordA: Actor, profA: Actor, profA2: Actor, profB: Actor, aluno: Actor;

  beforeEach(async () => {
    testDb = createTestDb();
    sA = await mk("schools", "name", ["Escola A"]);
    sB = await mk("schools", "name", ["Escola B"]);
    const uProfA = await user("profa", "teacher");
    const uProfA2 = await user("profa2", "teacher");
    const uProfB = await user("profb", "teacher");
    const uCoord = await user("coord", "coordinator");
    const uAdm = await user("adm", "admin");
    const uAluno = await user("aluno", "student");
    tA = await mk("teachers", "user_id, school_id", [uProfA, sA]);
    tA2 = await mk("teachers", "user_id, school_id", [uProfA2, sA]);
    tB = await mk("teachers", "user_id, school_id", [uProfB, sB]);
    await mk("coordinators", "user_id, school_id", [uCoord, sA]);
    clsA = await mk("classes", "school_id, teacher_id, name", [sA, tA, "6º A"]);
    clsA2 = await mk("classes", "school_id, teacher_id, name", [sA, tA2, "7º A"]);
    clsB = await mk("classes", "school_id, teacher_id, name", [sB, tB, "6º B"]);
    adm = { userId: uAdm, role: "admin" };
    coordA = { userId: uCoord, role: "coordinator" };
    profA = { userId: uProfA, role: "teacher" };
    profA2 = { userId: uProfA2, role: "teacher" };
    profB = { userId: uProfB, role: "teacher" };
    aluno = { userId: uAluno, role: "student" };
  });

  it("resolveSchoolId: escola própria; outra escola e aluno = null; admin informa", async () => {
    expect(await q.resolveSchoolId(profA)).toBe(sA);
    expect(await q.resolveSchoolId(profA, sA)).toBe(sA);
    expect(await q.resolveSchoolId(profA, sB)).toBeNull();
    expect(await q.resolveSchoolId(coordA, sB)).toBeNull();
    expect(await q.resolveSchoolId(aluno, sA)).toBeNull();
    expect(await q.resolveSchoolId(adm)).toBeNull();
    expect(await q.resolveSchoolId(adm, sB)).toBe(sB);
  });

  describe("disciplinas", () => {
    it("cria a lista padrão uma vez, por escola", async () => {
      const a1 = await q.listSubjects(sA);
      const a2 = await q.listSubjects(sA);
      expect(a1.length).toBeGreaterThanOrEqual(8);
      expect(a2).toHaveLength(a1.length);
      expect(a1.map((s) => s.name)).toContain("Matemática");
      expect((await q.listSubjects(sB)).every((s) => s.school_id === sB)).toBe(true);
    });

    it("professor cadastra disciplina nova na própria escola; repetida reaproveita; outra escola é recusada", async () => {
      const n1 = await q.createSubject(profA, sA, "  Robótica   Educacional ");
      expect(n1.name).toBe("Robótica Educacional");
      const n2 = await q.createSubject(profA, sA, "robótica educacional");
      expect(n2.id).toBe(n1.id);
      const lista = await q.listSubjects(sA);
      expect(lista.some((s) => s.name === "Matemática")).toBe(true); // padrões continuam
      await expect(q.createSubject(profA, sB, "Xadrez")).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      await expect(q.createSubject(aluno, sA, "Xadrez")).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      await expect(q.createSubject(profA, sA, "x")).rejects.toBeInstanceOf(q.CouncilInvalidError);
    });

    it("só admin/coordenador da escola desativam; professor não", async () => {
      const s = await q.createSubject(profA, sA, "Xadrez");
      await expect(q.setSubjectActive(profA, s.id, false)).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      expect((await q.setSubjectActive(coordA, s.id, false))?.active).toBe(false);
      expect((await q.listSubjects(sA)).some((x) => x.id === s.id)).toBe(false);
      expect((await q.listSubjects(sA, true)).some((x) => x.id === s.id)).toBe(true);
      const outra = (await q.listSubjects(sB))[0];
      await expect(q.setSubjectActive(coordA, outra.id, false)).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      expect(await q.setSubjectActive(adm, "00000000-0000-4000-8000-000000000000", false)).toBeNull();
    });
  });

  describe("bimestres", () => {
    it("cria 4 por escola/ano sem duplicar; atualiza só por quem gere a escola", async () => {
      const p = await q.listPeriods(sA, 2026);
      await q.listPeriods(sA, 2026);
      expect(p.map((x) => x.name)).toEqual(["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"]);
      expect((await q.listPeriods(sA, 2027))).toHaveLength(4);
      const up = await q.updatePeriod(coordA, p[0].id, { status: "closed", startsOn: "2026-02-01", endsOn: "2026-04-30" });
      expect(up?.status).toBe("closed");
      expect(up?.starts_on).toBe("2026-02-01");
      await expect(q.updatePeriod(profA, p[1].id, { status: "closed" })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      const pB = await q.listPeriods(sB, 2026);
      await expect(q.updatePeriod(coordA, pB[0].id, { status: "closed" })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      await expect(q.updatePeriod(coordA, p[1].id, { startsOn: "2026-05-10", endsOn: "2026-05-01" }))
        .rejects.toBeInstanceOf(q.CouncilInvalidError);
    });
  });

  describe("critérios", () => {
    it("traz os 9 critérios iniciais, na ordem, sem duplicar", async () => {
      const c = await q.listCriteria(sA);
      await q.listCriteria(sA);
      expect(c).toHaveLength(9);
      expect(c.map((x) => x.code).slice(0, 3)).toEqual(["rendimento", "avanco", "compreensao"]);
      expect(c.filter((x) => x.kind === "yesno")).toHaveLength(6);
      expect(c[0].options.map((o) => o.value)).toEqual(["acima", "media", "abaixo"]);
    });

    it("coordenador cria/edita/desativa na própria escola; professor e outra escola não", async () => {
      const n = await q.createCriterion(coordA, sA, { label: "Uso responsável de materiais", kind: "yesno" });
      expect(n.sort_order).toBe(10);
      expect((await q.listCriteria(sA))).toHaveLength(10);
      const up = await q.updateCriterion(coordA, n.id, { active: false });
      expect(up?.active).toBe(false);
      expect(await q.listCriteria(sA)).toHaveLength(9);
      await expect(q.createCriterion(profA, sA, { label: "Qualquer coisa", kind: "text" })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      await expect(q.createCriterion(coordA, sB, { label: "Qualquer coisa", kind: "text" })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      await expect(q.updateCriterion(profA, n.id, { label: "Novo texto" })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      // a configuração de uma escola não afeta a outra
      expect(await q.listCriteria(sB)).toHaveLength(9);
    });
  });

  describe("vínculos turma × disciplina × professor", () => {
    let matA: string, matB: string;
    beforeEach(async () => {
      matA = (await q.listSubjects(sA)).find((s) => s.name === "Matemática")!.id;
      matB = (await q.listSubjects(sB)).find((s) => s.name === "Matemática")!.id;
    });

    it("coordenador vincula qualquer professor da escola; reatribuir troca o professor sem duplicar", async () => {
      const a = await q.createAssignment(coordA, { classId: clsA, subjectId: matA, teacherId: tA2 });
      expect(a.teacher_id).toBe(tA2);
      const b = await q.createAssignment(coordA, { classId: clsA, subjectId: matA, teacherId: tA });
      expect(b.id).toBe(a.id);
      expect(b.teacher_id).toBe(tA);
      expect((await q.listAssignments(coordA))).toHaveLength(1);
    });

    it("professor só se vincula a si mesmo e só na turma pela qual é responsável", async () => {
      const ok = await q.createAssignment(profA, { classId: clsA, subjectId: matA, teacherId: tA });
      expect(ok.class_name).toBe("6º A");
      await expect(q.createAssignment(profA, { classId: clsA2, subjectId: matA, teacherId: tA })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      await expect(q.createAssignment(profA, { classId: clsA, subjectId: matA, teacherId: tA2 })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      await expect(q.createAssignment(aluno, { classId: clsA, subjectId: matA, teacherId: tA })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
    });

    it("recusa misturar escolas (disciplina, professor ou turma de outra escola)", async () => {
      await expect(q.createAssignment(adm, { classId: clsA, subjectId: matB, teacherId: tA })).rejects.toBeInstanceOf(q.CouncilInvalidError);
      await expect(q.createAssignment(adm, { classId: clsA, subjectId: matA, teacherId: tB })).rejects.toBeInstanceOf(q.CouncilInvalidError);
      await expect(q.createAssignment(coordA, { classId: clsB, subjectId: matB, teacherId: tB })).rejects.toBeInstanceOf(q.CouncilForbiddenError);
    });

    it("listagem por perfil: professor vê só os seus; coordenador a escola; aluno nada; admin tudo", async () => {
      await q.createAssignment(coordA, { classId: clsA, subjectId: matA, teacherId: tA });
      await q.createAssignment(coordA, { classId: clsA2, subjectId: matA, teacherId: tA2 });
      await q.createAssignment(adm, { classId: clsB, subjectId: matB, teacherId: tB });
      expect((await q.listAssignments(profA)).map((x) => x.class_name)).toEqual(["6º A"]);
      expect(await q.listAssignments(profA2)).toHaveLength(1);
      expect(await q.listAssignments(profB)).toHaveLength(1);
      expect(await q.listAssignments(coordA)).toHaveLength(2);
      expect(await q.listAssignments(aluno)).toEqual([]);
      expect(await q.listAssignments(adm)).toHaveLength(3);
    });

    it("desativar: só gestão da escola; vínculo inativo some da lista do professor", async () => {
      const a = await q.createAssignment(coordA, { classId: clsA, subjectId: matA, teacherId: tA });
      await expect(q.setAssignmentActive(profA, a.id, false)).rejects.toBeInstanceOf(q.CouncilForbiddenError);
      expect(await q.setAssignmentActive(coordA, a.id, false)).toBe(true);
      expect(await q.listAssignments(profA)).toHaveLength(0);
      expect(await q.setAssignmentActive(adm, "00000000-0000-4000-8000-000000000000", false)).toBe(false);
    });
  });
});
