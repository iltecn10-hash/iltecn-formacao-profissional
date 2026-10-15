import { query, queryOne } from "@/lib/db";
import { schoolScope } from "@/modules/schools/scope";
import type { ScopeActor } from "@/modules/schools/scope";
import {
  canManageSchool, listCriteria, CouncilForbiddenError, CouncilInvalidError,
  type Criterion, type Period,
} from "./queries";

type PeriodLite = Pick<Period, "id" | "school_id" | "school_year" | "sort_order" | "name" | "status">;

/** Resposta guardada com o texto do critério/opção da época — editar o formulário não reescreve o histórico. */
export interface StoredAnswer { label: string; value: string; valueLabel?: string }
export type StoredAnswers = Record<string, StoredAnswer>;

export type EvalStatus = "draft" | "final";

/** Avaliação travada (final) ou alterada por outra pessoa/aba. */
export class EvaluationLockedError extends Error {}
export class EvaluationConflictError extends Error {}

export const MAX_TEXT = 2000;

interface AssignmentCtx {
  id: string; class_id: string; class_name: string; subject_id: string; subject_name: string;
  teacher_id: string; teacher_user_id: string; teacher_name: string; school_id: string;
  school_year: number; active: boolean;
}

/** Vínculo visível ao ator: professor só o dele (ativo); coordenador/admin os da escola. Senão `null`. */
async function loadAssignment(actor: ScopeActor, assignmentId: string): Promise<AssignmentCtx | null> {
  const a = await queryOne<AssignmentCtx>(
    `SELECT cst.id, cst.class_id, c.name AS class_name, cst.subject_id, s.name AS subject_name,
            cst.teacher_id, t.user_id AS teacher_user_id, u.name AS teacher_name,
            c.school_id, c.school_year, cst.active
     FROM class_subject_teachers cst
     JOIN classes c ON c.id = cst.class_id
     JOIN subjects s ON s.id = cst.subject_id
     JOIN teachers t ON t.id = cst.teacher_id
     JOIN users u ON u.id = t.user_id
     WHERE cst.id = $1::uuid`, [assignmentId]);
  if (!a) return null;
  if (actor.role === "teacher") return a.teacher_user_id === actor.userId && a.active ? a : null;
  return (await canManageSchool(actor, a.school_id)) ? a : null;
}

async function loadPeriod(periodId: string, a: AssignmentCtx): Promise<PeriodLite | null> {
  const p = await queryOne<PeriodLite>(
    `SELECT id, school_id, school_year, sort_order, name, status FROM evaluation_periods WHERE id = $1::uuid`,
    [periodId]);
  return p && p.school_id === a.school_id && p.school_year === a.school_year ? p : null;
}

/** Valida as respostas contra os critérios ativos e devolve o instantâneo a gravar. */
export function buildAnswers(
  criteria: Criterion[], raw: Record<string, unknown>, finalize: boolean
): StoredAnswers {
  const byCode = new Map(criteria.map((c) => [c.code, c]));
  for (const code of Object.keys(raw)) {
    if (!byCode.has(code)) throw new CouncilInvalidError("Critério desconhecido ou desativado.");
  }
  const out: StoredAnswers = {};
  const missing: string[] = [];
  for (const c of criteria) {
    const v = raw[c.code];
    const empty = v == null || (typeof v === "string" && v.trim() === "");
    if (empty) {
      if (finalize && c.required) missing.push(c.label);
      continue;
    }
    if (typeof v !== "string") throw new CouncilInvalidError(`Resposta inválida em "${c.label}".`);
    if (c.kind === "text") {
      const text = v.trim();
      if (text.length > MAX_TEXT) throw new CouncilInvalidError(`"${c.label}" passou de ${MAX_TEXT} caracteres.`);
      out[c.code] = { label: c.label, value: text };
    } else {
      const opt = c.options.find((o) => o.value === v);
      if (!opt) throw new CouncilInvalidError(`Opção inválida em "${c.label}".`);
      out[c.code] = { label: c.label, value: opt.value, valueLabel: opt.label };
    }
  }
  if (missing.length)
    throw new CouncilInvalidError(`Falta responder: ${missing.join("; ")}.`);
  return out;
}

export interface SheetStudent {
  student_id: string; name: string; evaluation_id: string | null;
  status: EvalStatus | "none"; answers: StoredAnswers; version: number;
}
export interface Sheet {
  assignment: Pick<AssignmentCtx, "id" | "class_id" | "class_name" | "subject_id" | "subject_name" | "teacher_name" | "school_year">;
  period: PeriodLite;
  criteria: Criterion[];
  students: SheetStudent[];
  counts: { total: number; draft: number; final: number; pending: number };
}

export async function getSheet(actor: ScopeActor, assignmentId: string, periodId: string): Promise<Sheet | null> {
  const a = await loadAssignment(actor, assignmentId);
  if (!a) return null;
  const period = await loadPeriod(periodId, a);
  if (!period) return null;
  const criteria = await listCriteria(a.school_id);
  const students = await query<{ student_id: string; name: string }>(
    `SELECT st.id AS student_id, u.name FROM enrollments e
     JOIN students st ON st.id = e.student_id JOIN users u ON u.id = st.user_id
     WHERE e.class_id = $1::uuid AND e.status = 'active' ORDER BY u.name`, [a.class_id]);
  const evals = await query<{ id: string; student_id: string; status: EvalStatus; answers: StoredAnswers; version: number }>(
    `SELECT id, student_id, status, answers, version FROM council_evaluations
     WHERE class_id = $1::uuid AND subject_id = $2::uuid AND period_id = $3::uuid`,
    [a.class_id, a.subject_id, periodId]);
  const byStudent = new Map(evals.map((e) => [e.student_id, e]));
  const rows: SheetStudent[] = students.map((s) => {
    const e = byStudent.get(s.student_id);
    return {
      student_id: s.student_id, name: s.name, evaluation_id: e?.id ?? null,
      status: e?.status ?? "none", answers: e?.answers ?? {}, version: e?.version ?? 0,
    };
  });
  const final = rows.filter((r) => r.status === "final").length;
  const draft = rows.filter((r) => r.status === "draft").length;
  return {
    assignment: {
      id: a.id, class_id: a.class_id, class_name: a.class_name, subject_id: a.subject_id,
      subject_name: a.subject_name, teacher_name: a.teacher_name, school_year: a.school_year,
    },
    period, criteria, students: rows,
    counts: { total: rows.length, draft, final, pending: rows.length - final },
  };
}

export interface SaveInput {
  assignmentId: string; periodId: string; studentId: string;
  answers: Record<string, unknown>; expectedVersion?: number; finalize?: boolean;
}
export interface SavedEvaluation { id: string; status: EvalStatus; version: number; answers: StoredAnswers }

/**
 * Salva rascunho ou finaliza. SÓ o professor do vínculo avalia; bimestre precisa estar aberto;
 * o aluno precisa estar matriculado (ativo) na turma. Avaliação final fica travada.
 * Concorrência: o UPDATE exige `version` igual — duas abas/cliques nunca se sobrescrevem em silêncio.
 */
export async function saveEvaluation(actor: ScopeActor, input: SaveInput): Promise<SavedEvaluation> {
  if (actor.role !== "teacher") throw new CouncilForbiddenError();
  const a = await loadAssignment(actor, input.assignmentId);
  if (!a) throw new CouncilForbiddenError();
  const period = await loadPeriod(input.periodId, a);
  if (!period) throw new CouncilInvalidError("Bimestre inválido para esta turma.");
  if (period.status !== "open") throw new CouncilInvalidError("Este bimestre está encerrado.");
  const enrolled = await queryOne(
    `SELECT 1 AS ok FROM enrollments WHERE class_id = $1::uuid AND student_id = $2::uuid AND status = 'active'`,
    [a.class_id, input.studentId]);
  if (!enrolled) throw new CouncilInvalidError("Aluno não matriculado nesta turma.");

  const criteria = await listCriteria(a.school_id);
  const answers = buildAnswers(criteria, input.answers, !!input.finalize);
  const json = JSON.stringify(answers);

  const existing = await queryOne<{ id: string; status: EvalStatus; version: number }>(
    `SELECT id, status, version FROM council_evaluations
     WHERE class_id = $1::uuid AND subject_id = $2::uuid AND period_id = $3::uuid AND student_id = $4::uuid`,
    [a.class_id, a.subject_id, input.periodId, input.studentId]);

  let saved: SavedEvaluation | null;
  if (!existing) {
    saved = await queryOne<SavedEvaluation>(
      `INSERT INTO council_evaluations (school_id, class_id, subject_id, period_id, student_id, teacher_id,
                                        status, answers, finalized_at, finalized_by)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8::jsonb,
               CASE WHEN $7 = 'final' THEN now() END, CASE WHEN $7 = 'final' THEN $9::uuid END)
       ON CONFLICT (class_id, subject_id, period_id, student_id) DO NOTHING
       RETURNING id, status, version, answers`,
      [a.school_id, a.class_id, a.subject_id, input.periodId, input.studentId, a.teacher_id,
       input.finalize ? "final" : "draft", json, actor.userId]);
    if (!saved) throw new EvaluationConflictError();
    await logEvent(saved.id, actor.userId, "created", {});
  } else {
    if (existing.status === "final") throw new EvaluationLockedError();
    if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version)
      throw new EvaluationConflictError();
    saved = await queryOne<SavedEvaluation>(
      `UPDATE council_evaluations SET answers = $2::jsonb, status = $3, version = version + 1, updated_at = now(),
         teacher_id = $5::uuid,
         finalized_at = CASE WHEN $3 = 'final' THEN now() END,
         finalized_by = CASE WHEN $3 = 'final' THEN $6::uuid END
       WHERE id = $1::uuid AND version = $4::int AND status = 'draft'
       RETURNING id, status, version, answers`,
      [existing.id, json, input.finalize ? "final" : "draft", existing.version, a.teacher_id, actor.userId]);
    if (!saved) throw new EvaluationConflictError();
  }
  await logEvent(saved.id, actor.userId, input.finalize ? "finalized" : "saved", { answered: Object.keys(answers).length });
  return saved;
}

async function logEvent(evaluationId: string, actorId: string, action: string, details: object) {
  // A trilha é best-effort: falhar ao registrar não deve desfazer a avaliação já gravada.
  try {
    await query(
      `INSERT INTO council_evaluation_events (evaluation_id, actor_id, action, details)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`, [evaluationId, actorId, action, JSON.stringify(details)]);
  } catch (e) {
    console.error("[conselho] falha ao registrar evento", e instanceof Error ? e.message : "");
  }
}

/** Só a coordenação da escola (ou admin) reabre; exige motivo; o bimestre precisa estar aberto. */
export async function reopenEvaluation(actor: ScopeActor, evaluationId: string, reason: string) {
  const e = await queryOne<{ id: string; school_id: string; status: EvalStatus; period_id: string }>(
    `SELECT id, school_id, status, period_id FROM council_evaluations WHERE id = $1::uuid`, [evaluationId]);
  if (!e) return null;
  if (!(await canManageSchool(actor, e.school_id))) throw new CouncilForbiddenError();
  const why = reason.trim();
  if (why.length < 3 || why.length > 500) throw new CouncilInvalidError("Informe o motivo da reabertura.");
  if (e.status !== "final") throw new CouncilInvalidError("A avaliação já está em rascunho.");
  const period = await queryOne<{ status: string }>(
    `SELECT status FROM evaluation_periods WHERE id = $1::uuid`, [e.period_id]);
  if (period?.status !== "open") throw new CouncilInvalidError("Reabra o bimestre antes de reabrir a avaliação.");
  const row = await queryOne<{ id: string; status: EvalStatus; version: number }>(
    `UPDATE council_evaluations SET status = 'draft', finalized_at = NULL, finalized_by = NULL,
       version = version + 1, updated_at = now()
     WHERE id = $1::uuid AND status = 'final' RETURNING id, status, version`, [evaluationId]);
  if (!row) throw new EvaluationConflictError();
  await logEvent(evaluationId, actor.userId, "reopened", { reason: why });
  return row;
}

export interface EvaluationEvent {
  id: string; action: string; actor_name: string | null; details: Record<string, unknown>; created_at: string;
}
export async function listEvaluationEvents(actor: ScopeActor, evaluationId: string): Promise<EvaluationEvent[] | null> {
  const e = await queryOne<{ school_id: string }>(
    `SELECT school_id FROM council_evaluations WHERE id = $1::uuid`, [evaluationId]);
  if (!e) return null;
  if (!(await canManageSchool(actor, e.school_id))) throw new CouncilForbiddenError();
  return query<EvaluationEvent>(
    `SELECT ev.id, ev.action, u.name AS actor_name, ev.details, ev.created_at
     FROM council_evaluation_events ev LEFT JOIN users u ON u.id = ev.actor_id
     WHERE ev.evaluation_id = $1::uuid ORDER BY ev.created_at, ev.id`, [evaluationId]);
}

// ---------- Painel da coordenação ----------

export interface PanelRow {
  assignment_id: string; class_id: string; class_name: string; subject_name: string; teacher_name: string;
  total: number; draft: number; final: number; state: "sem_alunos" | "nao_iniciada" | "em_andamento" | "concluida";
}
export interface Panel {
  period: PeriodLite; rows: PanelRow[];
  classesWithoutAssignments: { id: string; name: string }[];
  totals: { assignments: number; concluded: number; inProgress: number; notStarted: number };
}

export async function getPanel(actor: ScopeActor, schoolId: string, periodId: string): Promise<Panel | null> {
  if (!(await canManageSchool(actor, schoolId))) throw new CouncilForbiddenError();
  const period = await queryOne<PeriodLite>(
    `SELECT id, school_id, school_year, sort_order, name, status FROM evaluation_periods
     WHERE id = $1::uuid AND school_id = $2::uuid`, [periodId, schoolId]);
  if (!period) return null;
  const assignments = await query<{
    id: string; class_id: string; class_name: string; subject_id: string; subject_name: string; teacher_name: string;
  }>(
    `SELECT cst.id, cst.class_id, c.name AS class_name, cst.subject_id, s.name AS subject_name, u.name AS teacher_name
     FROM class_subject_teachers cst JOIN classes c ON c.id = cst.class_id
     JOIN subjects s ON s.id = cst.subject_id JOIN teachers t ON t.id = cst.teacher_id JOIN users u ON u.id = t.user_id
     WHERE c.school_id = $1::uuid AND c.school_year = $2::int AND c.active = true AND cst.active = true
     ORDER BY c.name, s.name`, [schoolId, period.school_year]);
  const enr = await query<{ class_id: string; n: number }>(
    `SELECT e.class_id, COUNT(*)::int AS n FROM enrollments e JOIN classes c ON c.id = e.class_id
     WHERE e.status = 'active' AND c.school_id = $1::uuid GROUP BY e.class_id`, [schoolId]);
  const ev = await query<{ class_id: string; subject_id: string; status: EvalStatus; n: number }>(
    `SELECT class_id, subject_id, status, COUNT(*)::int AS n FROM council_evaluations
     WHERE period_id = $1::uuid GROUP BY class_id, subject_id, status`, [periodId]);
  const total = new Map(enr.map((r) => [r.class_id, r.n]));
  const cnt = (c: string, s: string, st: EvalStatus) =>
    ev.find((r) => r.class_id === c && r.subject_id === s && r.status === st)?.n ?? 0;

  const rows: PanelRow[] = assignments.map((a) => {
    const t = total.get(a.class_id) ?? 0;
    const draft = cnt(a.class_id, a.subject_id, "draft");
    const final = cnt(a.class_id, a.subject_id, "final");
    const state: PanelRow["state"] =
      t === 0 ? "sem_alunos" : final >= t ? "concluida" : draft + final > 0 ? "em_andamento" : "nao_iniciada";
    return {
      assignment_id: a.id, class_id: a.class_id, class_name: a.class_name, subject_name: a.subject_name,
      teacher_name: a.teacher_name, total: t, draft, final, state,
    };
  });
  const classes = await query<{ id: string; name: string }>(
    `SELECT id, name FROM classes WHERE school_id = $1::uuid AND school_year = $2::int AND active = true ORDER BY name`,
    [schoolId, period.school_year]);
  const withLinks = new Set(assignments.map((a) => a.class_id));
  return {
    period, rows,
    classesWithoutAssignments: classes.filter((c) => !withLinks.has(c.id)),
    totals: {
      assignments: rows.length,
      concluded: rows.filter((r) => r.state === "concluida").length,
      inProgress: rows.filter((r) => r.state === "em_andamento").length,
      notStarted: rows.filter((r) => r.state === "nao_iniciada").length,
    },
  };
}

// ---------- Relatórios ----------

export interface ReportEntry {
  period_name: string; period_order: number; school_year: number; subject_name: string;
  answers: StoredAnswers; finalized_at: string | null;
}
export interface StudentCouncilReport {
  student: { id: string; name: string; school_name: string };
  entries: ReportEntry[];
}

/** Histórico FINAL do aluno. Admin: tudo; coordenador: a escola; professor: só o que ELE avaliou. */
export async function getStudentCouncilReport(actor: ScopeActor, studentId: string): Promise<StudentCouncilReport | null> {
  const scope = schoolScope(actor, "st.school_id", 2);
  if (!scope) return null;
  const student = await queryOne<{ id: string; name: string; school_name: string }>(
    `SELECT st.id, u.name, sc.name AS school_name FROM students st
     JOIN users u ON u.id = st.user_id JOIN schools sc ON sc.id = st.school_id
     WHERE st.id = $1::uuid ${scope.where ? `AND ${scope.where}` : ""}`, [studentId, ...scope.params]);
  if (!student) return null;
  const teacherOnly = actor.role === "teacher"
    ? `AND e.teacher_id IN (SELECT id FROM teachers WHERE user_id = $2::uuid)` : "";
  const entries = await query<ReportEntry>(
    `SELECT p.name AS period_name, p.sort_order AS period_order, p.school_year, s.name AS subject_name,
            e.answers, e.finalized_at
     FROM council_evaluations e JOIN evaluation_periods p ON p.id = e.period_id JOIN subjects s ON s.id = e.subject_id
     WHERE e.student_id = $1::uuid AND e.status = 'final' ${teacherOnly}
     ORDER BY p.school_year, p.sort_order, s.name`,
    actor.role === "teacher" ? [studentId, actor.userId] : [studentId]);
  return { student, entries };
}

export interface ClassReport {
  class_name: string; period: PeriodLite; criteriaLabels: { code: string; label: string }[];
  subjects: string[];
  students: {
    student_id: string; name: string;
    bySubject: Record<string, StoredAnswers>;
    attention: string[];
  }[];
  summary: { code: string; label: string; counts: Record<string, number>; valueLabels: Record<string, string> }[];
  /** Avaliações ainda não finalizadas (vínculos ativos × alunos ativos − finais). */
  pendingCount: number;
}

/** Consolidado da turma no bimestre (só avaliações finais). Somente coordenação da escola/admin. */
export async function getClassReport(actor: ScopeActor, classId: string, periodId: string): Promise<ClassReport | null> {
  const cls = await queryOne<{ id: string; name: string; school_id: string; school_year: number }>(
    `SELECT id, name, school_id, school_year FROM classes WHERE id = $1::uuid`, [classId]);
  if (!cls) return null;
  if (!(await canManageSchool(actor, cls.school_id))) throw new CouncilForbiddenError();
  const period = await queryOne<PeriodLite>(
    `SELECT id, school_id, school_year, sort_order, name, status FROM evaluation_periods
     WHERE id = $1::uuid AND school_id = $2::uuid AND school_year = $3::int`, [periodId, cls.school_id, cls.school_year]);
  if (!period) return null;
  const rows = await query<{ student_id: string; student_name: string; subject_name: string; answers: StoredAnswers }>(
    `SELECT e.student_id, u.name AS student_name, s.name AS subject_name, e.answers
     FROM council_evaluations e JOIN students st ON st.id = e.student_id JOIN users u ON u.id = st.user_id
     JOIN subjects s ON s.id = e.subject_id
     WHERE e.class_id = $1::uuid AND e.period_id = $2::uuid AND e.status = 'final'
     ORDER BY u.name, s.name`, [classId, periodId]);
  const expected = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM class_subject_teachers cst
     JOIN enrollments en ON en.class_id = cst.class_id AND en.status = 'active'
     WHERE cst.class_id = $1::uuid AND cst.active = true`, [classId]);

  const subjects = [...new Set(rows.map((r) => r.subject_name))].sort();
  const byStudent = new Map<string, ClassReport["students"][number]>();
  const labels = new Map<string, string>();
  const summary = new Map<string, ClassReport["summary"][number]>();
  for (const r of rows) {
    let st = byStudent.get(r.student_id);
    if (!st) { st = { student_id: r.student_id, name: r.student_name, bySubject: {}, attention: [] }; byStudent.set(r.student_id, st); }
    st.bySubject[r.subject_name] = r.answers;
    for (const [code, a] of Object.entries(r.answers)) {
      labels.set(code, a.label);
      if (a.valueLabel === undefined) continue; // texto livre não entra em contagem
      let s = summary.get(code);
      if (!s) { s = { code, label: a.label, counts: {}, valueLabels: {} }; summary.set(code, s); }
      s.counts[a.value] = (s.counts[a.value] ?? 0) + 1;
      s.valueLabels[a.value] = a.valueLabel;
    }
    if (r.answers.rendimento?.value === "abaixo") st.attention.push(`${r.subject_name}: abaixo da média`);
    if (r.answers.avanco?.value === "estagnado") st.attention.push(`${r.subject_name}: estagnado`);
  }
  return {
    class_name: cls.name, period,
    criteriaLabels: [...labels].map(([code, label]) => ({ code, label })),
    subjects, students: [...byStudent.values()], summary: [...summary.values()],
    pendingCount: Math.max(0, (expected?.n ?? 0) - rows.length),
  };
}

/** Evita que o Excel/Planilhas execute uma célula como fórmula (CSV injection). */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function classReportToCsv(r: ClassReport): string {
  const head = ["Aluno", "Disciplina", ...r.criteriaLabels.map((c) => c.label)];
  const lines = [head.map(csvCell).join(";")];
  for (const st of r.students)
    for (const subject of r.subjects) {
      const a = st.bySubject[subject];
      if (!a) continue;
      lines.push([st.name, subject, ...r.criteriaLabels.map((c) => a[c.code]?.valueLabel ?? a[c.code]?.value ?? "")]
        .map(csvCell).join(";"));
    }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
