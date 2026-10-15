import { query, queryOne } from "@/lib/db";
import { getActorSchoolId, type ScopeActor } from "@/modules/schools/scope";
import { DEFAULT_SUBJECTS, DEFAULT_CRITERIA, PERIOD_COUNT, periodName } from "./defaults";

export interface Subject { id: string; school_id: string; name: string; active: boolean }
export interface Period {
  id: string; school_id: string; school_year: number; sort_order: number;
  name: string; starts_on: string | null; ends_on: string | null; status: "open" | "closed";
}
export interface Criterion {
  id: string; school_id: string; code: string; label: string; kind: "level" | "yesno" | "text";
  options: { value: string; label: string }[]; required: boolean; sort_order: number; active: boolean;
}
export interface Assignment {
  id: string; class_id: string; class_name: string; subject_id: string; subject_name: string;
  teacher_id: string; teacher_name: string; school_id: string; school_year: number; active: boolean;
}

export class CouncilForbiddenError extends Error {}
export class CouncilInvalidError extends Error {}

/**
 * `date` do pg chega como Date à meia-noite LOCAL (pg-mem: UTC). Devolve "AAAA-MM-DD" sem deslocar
 * o dia: se for meia-noite UTC usa os campos UTC, senão os locais.
 */
const dayStr = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    const utc = v.getUTCHours() === 0 && v.getUTCMinutes() === 0;
    const [y, m, d] = utc
      ? [v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()]
      : [v.getFullYear(), v.getMonth(), v.getDate()];
    return `${y}-${p(m + 1)}-${p(d)}`;
  }
  return String(v).slice(0, 10);
};
const fixPeriod = (p: Period | null): Period | null =>
  p && { ...p, starts_on: dayStr(p.starts_on), ends_on: dayStr(p.ends_on) };

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Escola sobre a qual o ator age. Admin informa a escola; coordenador e professor só a própria
 * (se pedirem outra, `null` = sem permissão). Aluno e demais perfis nunca.
 */
export async function resolveSchoolId(actor: ScopeActor, requested?: string | null): Promise<string | null> {
  if (actor.role === "admin") return requested ?? null;
  if (actor.role !== "teacher" && actor.role !== "coordinator") return null;
  const own = await getActorSchoolId(actor);
  if (!own) return null;
  if (requested && requested !== own) return null;
  return own;
}

/** Pode GERIR (períodos, critérios, vínculos, desativar disciplinas) a escola: admin ou coordenador dela. */
export async function canManageSchool(actor: ScopeActor, schoolId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "coordinator") return false;
  return (await getActorSchoolId(actor)) === schoolId;
}

type Owned = "subjects" | "evaluation_periods" | "council_criteria";
async function schoolOf(table: Owned, id: string): Promise<string | null> {
  const row = await queryOne<{ school_id: string }>(`SELECT school_id FROM ${table} WHERE id = $1::uuid`, [id]);
  return row?.school_id ?? null;
}

// ---------- Disciplinas ----------

export async function ensureSubjectDefaults(schoolId: string): Promise<void> {
  const existing = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM subjects WHERE school_id = $1::uuid`, [schoolId]);
  if ((existing?.n ?? 0) > 0) return; // escola que já mexeu na lista não recebe os padrões de volta
  for (const name of DEFAULT_SUBJECTS) {
    await query(
      `INSERT INTO subjects (school_id, name, name_key) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (school_id, name_key) DO NOTHING`,
      [schoolId, name, normalizeName(name)]);
  }
}

export async function listSubjects(schoolId: string, includeInactive = false): Promise<Subject[]> {
  await ensureSubjectDefaults(schoolId);
  return query<Subject>(
    `SELECT id, school_id, name, active FROM subjects
     WHERE school_id = $1::uuid ${includeInactive ? "" : "AND active = true"} ORDER BY name`,
    [schoolId]);
}

/** Professor, coordenador e admin podem cadastrar. Nome repetido reaproveita (e reativa) o existente. */
export async function createSubject(actor: ScopeActor, schoolId: string, name: string): Promise<Subject> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 120) throw new CouncilInvalidError("Nome da disciplina inválido.");
  if ((await resolveSchoolId(actor, schoolId)) !== schoolId) throw new CouncilForbiddenError();
  await ensureSubjectDefaults(schoolId); // evita que a 1ª disciplina nova "desligue" os padrões
  const row = await queryOne<Subject>(
    `INSERT INTO subjects (school_id, name, name_key, created_by) VALUES ($1::uuid, $2, $3, $4::uuid)
     ON CONFLICT (school_id, name_key) DO UPDATE SET active = true
     RETURNING id, school_id, name, active`,
    [schoolId, clean, normalizeName(clean), actor.userId]);
  return row!;
}

export async function setSubjectActive(actor: ScopeActor, id: string, active: boolean): Promise<Subject | null> {
  const school = await schoolOf("subjects", id);
  if (!school) return null;
  if (!(await canManageSchool(actor, school))) throw new CouncilForbiddenError();
  return queryOne<Subject>(
    `UPDATE subjects SET active = $2 WHERE id = $1::uuid RETURNING id, school_id, name, active`, [id, active]);
}

// ---------- Períodos (bimestres) ----------

export async function ensurePeriods(schoolId: string, year: number): Promise<void> {
  for (let n = 1; n <= PERIOD_COUNT; n++) {
    await query(
      `INSERT INTO evaluation_periods (school_id, school_year, sort_order, name)
       VALUES ($1::uuid, $2::int, $3::int, $4) ON CONFLICT (school_id, school_year, sort_order) DO NOTHING`,
      [schoolId, year, n, periodName(n)]);
  }
}

export async function listPeriods(schoolId: string, year: number): Promise<Period[]> {
  await ensurePeriods(schoolId, year);
  const rows = await query<Period>(
    `SELECT id, school_id, school_year, sort_order, name, starts_on, ends_on, status
     FROM evaluation_periods WHERE school_id = $1::uuid AND school_year = $2::int ORDER BY sort_order`,
    [schoolId, year]);
  return rows.map((r) => fixPeriod(r)!);
}

export async function updatePeriod(
  actor: ScopeActor, id: string,
  patch: { name?: string; startsOn?: string | null; endsOn?: string | null; status?: "open" | "closed" }
): Promise<Period | null> {
  const school = await schoolOf("evaluation_periods", id);
  if (!school) return null;
  if (!(await canManageSchool(actor, school))) throw new CouncilForbiddenError();
  if (patch.startsOn && patch.endsOn && patch.startsOn > patch.endsOn)
    throw new CouncilInvalidError("A data final não pode ser anterior à inicial.");
  return fixPeriod(await queryOne<Period>(
    `UPDATE evaluation_periods SET
       name = COALESCE($2, name),
       starts_on = CASE WHEN $3::boolean THEN $4::date ELSE starts_on END,
       ends_on = CASE WHEN $5::boolean THEN $6::date ELSE ends_on END,
       status = COALESCE($7, status)
     WHERE id = $1::uuid
     RETURNING id, school_id, school_year, sort_order, name, starts_on, ends_on, status`,
    [id, patch.name ?? null, patch.startsOn !== undefined, patch.startsOn ?? null,
     patch.endsOn !== undefined, patch.endsOn ?? null, patch.status ?? null]));
}

// ---------- Critérios ----------

export async function ensureCriteriaDefaults(schoolId: string): Promise<void> {
  const existing = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM council_criteria WHERE school_id = $1::uuid`, [schoolId]);
  if ((existing?.n ?? 0) > 0) return;
  let order = 1;
  for (const c of DEFAULT_CRITERIA) {
    await query(
      `INSERT INTO council_criteria (school_id, code, label, kind, options, required, sort_order)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7::int) ON CONFLICT (school_id, code) DO NOTHING`,
      [schoolId, c.code, c.label, c.kind, JSON.stringify(c.options), c.required, order++]);
  }
}

export async function listCriteria(schoolId: string, includeInactive = false): Promise<Criterion[]> {
  await ensureCriteriaDefaults(schoolId);
  return query<Criterion>(
    `SELECT id, school_id, code, label, kind, options, required, sort_order, active
     FROM council_criteria WHERE school_id = $1::uuid ${includeInactive ? "" : "AND active = true"}
     ORDER BY sort_order, label`, [schoolId]);
}

export async function createCriterion(
  actor: ScopeActor, schoolId: string,
  input: { label: string; kind: "yesno" | "text"; required?: boolean }
): Promise<Criterion> {
  if (!(await canManageSchool(actor, schoolId))) throw new CouncilForbiddenError();
  const label = input.label.trim();
  if (label.length < 3 || label.length > 200) throw new CouncilInvalidError("Texto do critério inválido.");
  await ensureCriteriaDefaults(schoolId);
  const next = await queryOne<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS n FROM council_criteria WHERE school_id = $1::uuid`, [schoolId]);
  const options = input.kind === "yesno"
    ? [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }] : [];
  // O código é gerado pelo servidor (estável, único); o texto exibido pode mudar depois.
  const code = `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const row = await queryOne<Criterion>(
    `INSERT INTO council_criteria (school_id, code, label, kind, options, required, sort_order)
     VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7::int)
     RETURNING id, school_id, code, label, kind, options, required, sort_order, active`,
    [schoolId, code, label, input.kind, JSON.stringify(options), input.required ?? true, next!.n]);
  return row!;
}

export async function updateCriterion(
  actor: ScopeActor, id: string,
  patch: { label?: string; active?: boolean; required?: boolean; sortOrder?: number }
): Promise<Criterion | null> {
  const school = await schoolOf("council_criteria", id);
  if (!school) return null;
  if (!(await canManageSchool(actor, school))) throw new CouncilForbiddenError();
  return queryOne<Criterion>(
    `UPDATE council_criteria SET
       label = COALESCE($2, label), active = COALESCE($3, active),
       required = COALESCE($4, required), sort_order = COALESCE($5::int, sort_order)
     WHERE id = $1::uuid
     RETURNING id, school_id, code, label, kind, options, required, sort_order, active`,
    [id, patch.label?.trim() ?? null, patch.active ?? null, patch.required ?? null, patch.sortOrder ?? null]);
}

// ---------- Vínculos turma × disciplina × professor ----------

/**
 * Lista os vínculos visíveis ao ator: admin (de uma escola, ou todas), coordenador (sua escola),
 * professor (só os DELE). Escopo decidido no SQL.
 */
export async function listAssignments(actor: ScopeActor, schoolId?: string | null): Promise<Assignment[]> {
  const base = `SELECT cst.id, cst.class_id, c.name AS class_name, cst.subject_id, s.name AS subject_name,
         cst.teacher_id, u.name AS teacher_name, c.school_id, c.school_year, cst.active
       FROM class_subject_teachers cst
       JOIN classes c ON c.id = cst.class_id
       JOIN subjects s ON s.id = cst.subject_id
       JOIN teachers t ON t.id = cst.teacher_id
       JOIN users u ON u.id = t.user_id`;
  const order = ` ORDER BY c.name, s.name`;
  if (actor.role === "admin")
    return schoolId
      ? query<Assignment>(`${base} WHERE c.school_id = $1::uuid${order}`, [schoolId])
      : query<Assignment>(`${base}${order}`);
  if (actor.role === "coordinator")
    return query<Assignment>(
      `${base} WHERE c.school_id IN (SELECT school_id FROM coordinators WHERE user_id = $1::uuid)${order}`,
      [actor.userId]);
  if (actor.role === "teacher")
    return query<Assignment>(
      `${base} WHERE t.user_id = $1::uuid AND cst.active = true${order}`, [actor.userId]);
  return [];
}

/**
 * Cria (ou reativa/troca o professor de) um vínculo. Admin/coordenador da escola: qualquer professor
 * da escola. Professor: só ele mesmo e só em turma pela qual é responsável.
 */
export async function createAssignment(
  actor: ScopeActor, input: { classId: string; subjectId: string; teacherId: string }
): Promise<Assignment> {
  const cls = await queryOne<{ school_id: string; teacher_id: string | null }>(
    `SELECT school_id, teacher_id FROM classes WHERE id = $1::uuid AND active = true`, [input.classId]);
  if (!cls) throw new CouncilInvalidError("Turma não encontrada.");
  const subject = await queryOne<{ school_id: string; active: boolean }>(
    `SELECT school_id, active FROM subjects WHERE id = $1::uuid`, [input.subjectId]);
  const teacher = await queryOne<{ school_id: string | null; user_id: string }>(
    `SELECT school_id, user_id FROM teachers WHERE id = $1::uuid`, [input.teacherId]);
  if (!subject?.active || subject.school_id !== cls.school_id)
    throw new CouncilInvalidError("Disciplina não pertence à escola da turma.");
  if (!teacher || teacher.school_id !== cls.school_id)
    throw new CouncilInvalidError("Professor não pertence à escola da turma.");

  const manager = await canManageSchool(actor, cls.school_id);
  const selfOnOwnClass =
    actor.role === "teacher" && teacher.user_id === actor.userId && cls.teacher_id === input.teacherId;
  if (!manager && !selfOnOwnClass) throw new CouncilForbiddenError();

  const row = await queryOne<{ id: string }>(
    `INSERT INTO class_subject_teachers (class_id, subject_id, teacher_id) VALUES ($1::uuid,$2::uuid,$3::uuid)
     ON CONFLICT (class_id, subject_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id, active = true
     RETURNING id`, [input.classId, input.subjectId, input.teacherId]);
  const all = await listAssignments({ userId: actor.userId, role: manager ? actor.role : "admin" }, cls.school_id);
  return all.find((a) => a.id === row!.id)!;
}

export async function setAssignmentActive(actor: ScopeActor, id: string, active: boolean): Promise<boolean> {
  const row = await queryOne<{ school_id: string }>(
    `SELECT c.school_id FROM class_subject_teachers cst JOIN classes c ON c.id = cst.class_id
     WHERE cst.id = $1::uuid`, [id]);
  if (!row) return false;
  if (!(await canManageSchool(actor, row.school_id))) throw new CouncilForbiddenError();
  await query(`UPDATE class_subject_teachers SET active = $2 WHERE id = $1::uuid`, [id, active]);
  return true;
}
