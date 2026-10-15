import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";
import type { UserRole } from "@/types";

let testDb: ReturnType<typeof createTestDb>;
vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const base = await import("@/modules/council/queries");
const ev = await import("@/modules/council/evaluations");

async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
const user = (n: string, role: string) => mk("users", "email, password_hash, name, role", [`${n}@x.com`, "h", n, role]);
type Actor = { userId: string; role: UserRole };

const COMPLETE = {
  rendimento: "media", avanco: "esperado", compreensao: "sim", raciocinio: "sim", tarefas: "nao",
  participacao: "sim", convivencia: "sim", assiduidade: "sim",
};

describe("Conselho de Classe — avaliações, painel e relatórios", () => {
  let sA: string, sB: string, cls: string, clsB: string, tA: string, tOther: string, tB: string;
  let st1: string, st2: string, stOut: string, stB: string, mat: string, por: string, p1: string, p2: string;
  let asg: string, asgPor: string;
  let prof: Actor, profOther: Actor, profB: Actor, coord: Actor, coordB: Actor, adm: Actor, aluno: Actor;

  beforeEach(async () => {
    testDb = createTestDb();
    sA = await mk("schools", "name", ["Escola A"]);
    sB = await mk("schools", "name", ["Escola B"]);
    const [uP, uO, uPB, uC, uCB, uAdm, uAl] = await Promise.all(
      ["prof", "outro", "profb", "coord", "coordb", "adm", "aluno"].map((n, i) =>
        user(n, ["teacher", "teacher", "teacher", "coordinator", "coordinator", "admin", "student"][i])));
    tA = await mk("teachers", "user_id, school_id", [uP, sA]);
    tOther = await mk("teachers", "user_id, school_id", [uO, sA]);
    tB = await mk("teachers", "user_id, school_id", [uPB, sB]);
    await mk("coordinators", "user_id, school_id", [uC, sA]);
    await mk("coordinators", "user_id, school_id", [uCB, sB]);
    cls = await mk("classes", "school_id, teacher_id, name, school_year", [sA, tA, "6º A", 2026]);
    clsB = await mk("classes", "school_id, teacher_id, name, school_year", [sB, tB, "6º B", 2026]);
    const mkStudent = async (n: string, school: string, klass: string, status = "active") => {
      const u = await user(n, "student");
      const id = await mk("students", "user_id, school_id", [u, school]);
      await testDb.query(`INSERT INTO enrollments (student_id, class_id, status) VALUES ($1,$2,$3)`, [id, klass, status]);
      return id;
    };
    st1 = await mkStudent("ana", sA, cls);
    st2 = await mkStudent("bruno", sA, cls);
    stOut = await mkStudent("carlos", sA, cls, "inactive");
    stB = await mkStudent("davi", sB, clsB);
    prof = { userId: uP, role: "teacher" }; profOther = { userId: uO, role: "teacher" };
    profB = { userId: uPB, role: "teacher" }; coord = { userId: uC, role: "coordinator" };
    coordB = { userId: uCB, role: "coordinator" }; adm = { userId: uAdm, role: "admin" };
    aluno = { userId: uAl, role: "student" };
    const subs = await base.listSubjects(sA);
    mat = subs.find((s) => s.name === "Matemática")!.id;
    por = subs.find((s) => s.name === "Língua Portuguesa")!.id;
    const subsB = await base.listSubjects(sB);
    p1 = (await base.listPeriods(sA, 2026))[0].id;
    p2 = (await base.listPeriods(sA, 2026))[1].id;
    asg = (await base.createAssignment(coord, { classId: cls, subjectId: mat, teacherId: tA })).id;
    asgPor = (await base.createAssignment(coord, { classId: cls, subjectId: por, teacherId: tOther })).id;
    await base.createAssignment(adm, { classId: clsB, subjectId: subsB[0].id, teacherId: tB });
  });

  const save = (actor: Actor, studentId: string, answers: Record<string, string>, extra: object = {}) =>
    ev.saveEvaluation(actor, { assignmentId: asg, periodId: p1, studentId, answers, ...extra });

  describe("ficha e validação", () => {
    it("professor vê só os alunos ativos da turma; critérios ativos; ninguém sem vínculo", async () => {
      const sheet = (await ev.getSheet(prof, asg, p1))!;
      expect(sheet.students.map((s) => s.name)).toEqual(["ana", "bruno"]);
      expect(sheet.criteria).toHaveLength(9);
      expect(sheet.counts).toEqual({ total: 2, draft: 0, final: 0, pending: 2 });
      expect(await ev.getSheet(profOther, asg, p1)).toBeNull();   // vínculo de outro professor
      expect(await ev.getSheet(profB, asg, p1)).toBeNull();       // outra escola
      expect(await ev.getSheet(aluno, asg, p1)).toBeNull();
      expect(await ev.getSheet(coordB, asg, p1)).toBeNull();
      expect(await ev.getSheet(coord, asg, p1)).not.toBeNull();   // coordenação da escola vê
      expect(await ev.getSheet(prof, asg, "00000000-0000-4000-8000-000000000000")).toBeNull(); // bimestre inexistente
    });

    it("rascunho aceita parcial; finalizar exige os obrigatórios; observações são opcionais", async () => {
      const d = await save(prof, st1, { rendimento: "acima" });
      expect(d.status).toBe("draft");
      expect(d.answers.rendimento).toMatchObject({ value: "acima", valueLabel: "Acima da média", label: "Rendimento / Nota na disciplina" });
      await expect(save(prof, st1, { rendimento: "acima" }, { finalize: true })).rejects.toBeInstanceOf(base.CouncilInvalidError);
      const f = await save(prof, st1, { ...COMPLETE, observacoes: "  Precisa de reforço em frações.  " }, { finalize: true });
      expect(f.status).toBe("final");
      expect(f.answers.observacoes.value).toBe("Precisa de reforço em frações.");
      const f2 = await save(prof, st2, COMPLETE, { finalize: true }); // sem observações
      expect(f2.status).toBe("final");
    });

    it("recusa opção inválida, critério desconhecido, texto enorme e aluno de fora da turma", async () => {
      await expect(save(prof, st1, { rendimento: "otimo" })).rejects.toBeInstanceOf(base.CouncilInvalidError);
      await expect(save(prof, st1, { inventado: "sim" })).rejects.toBeInstanceOf(base.CouncilInvalidError);
      await expect(save(prof, st1, { observacoes: "x".repeat(2001) })).rejects.toBeInstanceOf(base.CouncilInvalidError);
      await expect(save(prof, stOut, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilInvalidError); // matrícula inativa
      await expect(save(prof, stB, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilInvalidError);   // outra escola
    });

    it("só o professor DO VÍNCULO avalia (nem outro professor, nem coordenação, nem aluno)", async () => {
      await expect(save(profOther, st1, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(save(profB, st1, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(save(coord, st1, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(save(adm, st1, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(save(aluno, st1, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilForbiddenError);
    });
  });

  describe("estados, versão e auditoria", () => {
    it("rascunho incrementa a versão; versão velha dá conflito; final trava", async () => {
      const a = await save(prof, st1, { rendimento: "media" });
      expect(a.version).toBe(1);
      const b = await save(prof, st1, { rendimento: "abaixo" }, { expectedVersion: 1 });
      expect(b.version).toBe(2);
      await expect(save(prof, st1, { rendimento: "acima" }, { expectedVersion: 1 })).rejects.toBeInstanceOf(ev.EvaluationConflictError);
      await save(prof, st1, COMPLETE, { finalize: true, expectedVersion: 2 });
      await expect(save(prof, st1, { rendimento: "acima" })).rejects.toBeInstanceOf(ev.EvaluationLockedError);
      const rows = await testDb.query(`SELECT id FROM council_evaluations WHERE student_id = $1`, [st1]);
      expect(rows).toHaveLength(1); // nunca duplica
    });

    it("bimestre encerrado bloqueia; vínculo desativado bloqueia", async () => {
      const per = (await base.listPeriods(sA, 2026))[0];
      await base.updatePeriod(coord, per.id, { status: "closed" });
      await expect(save(prof, st1, { rendimento: "media" })).rejects.toBeInstanceOf(base.CouncilInvalidError);
      await base.updatePeriod(coord, per.id, { status: "open" });
      await save(prof, st1, { rendimento: "media" });
      await base.setAssignmentActive(coord, asg, false);
      await expect(save(prof, st1, { rendimento: "abaixo" })).rejects.toBeInstanceOf(base.CouncilForbiddenError);
    });

    it("reabertura: só coordenação da escola, com motivo, bimestre aberto; auditoria completa", async () => {
      const f = await save(prof, st1, COMPLETE, { finalize: true });
      await expect(ev.reopenEvaluation(prof, f.id, "quero mudar")).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(ev.reopenEvaluation(coordB, f.id, "quero mudar")).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(ev.reopenEvaluation(coord, f.id, " ")).rejects.toBeInstanceOf(base.CouncilInvalidError);
      const per = (await base.listPeriods(sA, 2026))[0];
      await base.updatePeriod(coord, per.id, { status: "closed" });
      await expect(ev.reopenEvaluation(coord, f.id, "erro de digitação")).rejects.toBeInstanceOf(base.CouncilInvalidError);
      await base.updatePeriod(coord, per.id, { status: "open" });
      const r = await ev.reopenEvaluation(coord, f.id, "erro de digitação");
      expect(r?.status).toBe("draft");
      await expect(ev.reopenEvaluation(coord, f.id, "de novo")).rejects.toBeInstanceOf(base.CouncilInvalidError); // já é rascunho
      const again = await save(prof, st1, { ...COMPLETE, tarefas: "sim" }, { finalize: true });
      expect(again.answers.tarefas.value).toBe("sim");
      const events = (await ev.listEvaluationEvents(coord, f.id))!;
      expect(events.map((e) => e.action)).toEqual(["created", "finalized", "reopened", "finalized"]);
      expect(events[2].details).toMatchObject({ reason: "erro de digitação" });
      await expect(ev.listEvaluationEvents(prof, f.id)).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      expect(await ev.reopenEvaluation(adm, "00000000-0000-4000-8000-000000000000", "motivo")).toBeNull();
    });

    it("histórico preserva o texto da época mesmo se o critério mudar depois", async () => {
      const f = await save(prof, st1, COMPLETE, { finalize: true });
      const crit = (await base.listCriteria(sA)).find((c) => c.code === "tarefas")!;
      await base.updateCriterion(coord, crit.id, { label: "Entrega de atividades (novo texto)" });
      const sheet = (await ev.getSheet(coord, asg, p1))!;
      expect(sheet.students[0].answers.tarefas.label).toBe("Cumprimento de tarefas e entregas");
      expect(f.status).toBe("final");
    });
  });

  describe("painel da coordenação", () => {
    it("conta rascunhos/finais por vínculo, destaca pendências e turmas sem vínculo", async () => {
      await mk("classes", "school_id, teacher_id, name, school_year", [sA, tA, "7º A", 2026]);
      await save(prof, st1, COMPLETE, { finalize: true });
      await save(prof, st2, { rendimento: "media" });
      const panel = (await ev.getPanel(coord, sA, p1))!;
      const mat_ = panel.rows.find((r) => r.subject_name === "Matemática")!;
      expect(mat_).toMatchObject({ total: 2, final: 1, draft: 1, state: "em_andamento" });
      expect(panel.rows.find((r) => r.subject_name === "Língua Portuguesa")!.state).toBe("nao_iniciada");
      await save(prof, st2, COMPLETE, { finalize: true });
      expect((await ev.getPanel(coord, sA, p1))!.rows.find((r) => r.subject_name === "Matemática")!.state).toBe("concluida");
      expect(panel.classesWithoutAssignments.map((c) => c.name)).toEqual(["7º A"]);
      expect((await ev.getPanel(coord, sA, p2))!.totals.notStarted).toBe(2); // outro bimestre não mistura
    });

    it("professor, aluno e outra escola não veem o painel", async () => {
      await expect(ev.getPanel(prof, sA, p1)).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(ev.getPanel(aluno, sA, p1)).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(ev.getPanel(coordB, sA, p1)).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      expect(await ev.getPanel(adm, sA, "00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });

  describe("relatórios", () => {
    beforeEach(async () => {
      await save(prof, st1, { ...COMPLETE, rendimento: "abaixo", avanco: "estagnado", observacoes: "=cmd|' /C calc'!A0" }, { finalize: true });
      await save(prof, st2, COMPLETE, { finalize: true });
      await ev.saveEvaluation(profOther, { assignmentId: asgPor, periodId: p1, studentId: st1, answers: { ...COMPLETE, rendimento: "media" }, finalize: true });
      await save(prof, st2, { rendimento: "acima" }).catch(() => undefined); // já final: travado
    });

    it("individual: só avaliações finais; professor vê só o que ele avaliou; outra escola não vê", async () => {
      const r = (await ev.getStudentCouncilReport(coord, st1))!;
      expect(r.entries.map((e) => e.subject_name)).toEqual(["Língua Portuguesa", "Matemática"]);
      const meu = (await ev.getStudentCouncilReport(prof, st1))!;
      expect(meu.entries.map((e) => e.subject_name)).toEqual(["Matemática"]);
      expect(await ev.getStudentCouncilReport(coordB, st1)).toBeNull();
      expect(await ev.getStudentCouncilReport(profB, st1)).toBeNull();
      expect(await ev.getStudentCouncilReport(aluno, st1)).toBeNull();
      expect((await ev.getStudentCouncilReport(adm, st1))!.entries).toHaveLength(2);
    });

    it("rascunhos não aparecem nos relatórios", async () => {
      await ev.saveEvaluation(profOther, { assignmentId: asgPor, periodId: p1, studentId: st2, answers: { rendimento: "media" } });
      const r = (await ev.getStudentCouncilReport(coord, st2))!;
      expect(r.entries.map((e) => e.subject_name)).toEqual(["Matemática"]);
    });

    it("consolidado da turma: contagens, alunos em atenção, pendências; só coordenação", async () => {
      const r = (await ev.getClassReport(coord, cls, p1))!;
      expect(r.subjects).toEqual(["Língua Portuguesa", "Matemática"]);
      const rend = r.summary.find((s) => s.code === "rendimento")!;
      expect(rend.counts).toEqual({ abaixo: 1, media: 2 });
      expect(r.students.find((s) => s.name === "ana")!.attention).toEqual(["Matemática: abaixo da média", "Matemática: estagnado"]);
      expect(r.students.find((s) => s.name === "bruno")!.attention).toEqual([]);
      expect(r.pendingCount).toBe(1); // 2 vínculos × 2 alunos = 4 esperadas − 3 finais
      await expect(ev.getClassReport(prof, cls, p1)).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      await expect(ev.getClassReport(coordB, cls, p1)).rejects.toBeInstanceOf(base.CouncilForbiddenError);
      expect(await ev.getClassReport(coord, cls, "00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("CSV neutraliza fórmulas e escapa aspas", async () => {
      const csv = ev.classReportToCsv((await ev.getClassReport(coord, cls, p1))!);
      expect(csv.startsWith("﻿\"Aluno\";\"Disciplina\"")).toBe(true);
      expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
      expect(csv).not.toMatch(/;"=cmd/);
      expect(ev.csvCell('diz "oi"')).toBe('"diz ""oi"""');
      expect(ev.csvCell("+1")).toBe("\"'+1\"");
    });
  });
});
