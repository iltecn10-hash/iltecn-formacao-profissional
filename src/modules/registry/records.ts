import { query, queryOne } from "@/lib/db";
import { getActorSchoolId, type ScopeActor } from "@/modules/schools/scope";

/**
 * Editar / excluir cadastros (escolas, professores, alunos, turmas).
 *
 * "Excluir" é INTELIGENTE: se o cadastro nunca foi usado, é apagado de vez; se já tem
 * histórico (matrículas, notas, avaliações, vendas…), é só DESATIVADO — some do uso, o
 * histórico fica e dá para reativar. Quem decide é o servidor, nunca a tela.
 */

export class RecordError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message);
  }
}

export type DeleteResult = "deleted" | "deactivated";

async function count(sql: string, params: unknown[]): Promise<number> {
  const row = await queryOne<{ n: number | string }>(sql, params);
  return Number(row?.n ?? 0);
}

function isDuplicate(err: unknown): boolean {
  return err instanceof Error && err.message.includes("duplicate");
}

async function teacherIdOf(actor: ScopeActor): Promise<string | null> {
  if (actor.role !== "teacher") return null;
  const row = await queryOne<{ id: string }>(`SELECT id FROM teachers WHERE user_id = $1::uuid`, [actor.userId]);
  return row?.id ?? null;
}

/** admin: qualquer escola; coordenador: só a própria; demais: não. */
async function manageableSchool(actor: ScopeActor, schoolId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role === "coordinator") return (await getActorSchoolId(actor)) === schoolId;
  return false;
}

const FORBIDDEN = new RecordError(403, "Você não tem permissão para esta ação.");
const NOT_FOUND = new RecordError(404, "Cadastro não encontrado.");

// ─────────────────────────── Escolas (só admin) ───────────────────────────

export interface SchoolEdit {
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export async function updateSchool(actor: ScopeActor, id: string, input: SchoolEdit) {
  if (actor.role !== "admin") throw FORBIDDEN;
  const row = await queryOne<{ id: string }>(
    `UPDATE schools SET name = $2, code = $3, address = $4, city = $5, state = $6, updated_at = now()
     WHERE id = $1::uuid RETURNING id`,
    [id, input.name, input.code ?? null, input.address ?? null, input.city ?? null, input.state ?? null]
  );
  if (!row) throw NOT_FOUND;
}

export async function setSchoolActive(actor: ScopeActor, id: string, active: boolean) {
  if (actor.role !== "admin") throw FORBIDDEN;
  const row = await queryOne<{ id: string }>(
    `UPDATE schools SET active = $2, updated_at = now() WHERE id = $1::uuid RETURNING id`,
    [id, active]
  );
  if (!row) throw NOT_FOUND;
}

export async function deleteSchool(actor: ScopeActor, id: string): Promise<DeleteResult> {
  if (actor.role !== "admin") throw FORBIDDEN;
  const exists = await queryOne<{ id: string }>(`SELECT id FROM schools WHERE id = $1::uuid`, [id]);
  if (!exists) throw NOT_FOUND;
  const used = await count(
    `SELECT (SELECT COUNT(*) FROM classes WHERE school_id = $1::uuid)
          + (SELECT COUNT(*) FROM students WHERE school_id = $1::uuid)
          + (SELECT COUNT(*) FROM teachers WHERE school_id = $1::uuid)
          + (SELECT COUNT(*) FROM coordinators WHERE school_id = $1::uuid)
          + (SELECT COUNT(*) FROM council_evaluations WHERE school_id = $1::uuid) AS n`,
    [id]
  );
  if (used > 0) {
    await query(`UPDATE schools SET active = false, updated_at = now() WHERE id = $1::uuid`, [id]);
    return "deactivated";
  }
  // Padrões do Conselho criados automaticamente (sem avaliações) saem junto.
  await query(`DELETE FROM council_criteria WHERE school_id = $1::uuid`, [id]);
  await query(`DELETE FROM evaluation_periods WHERE school_id = $1::uuid`, [id]);
  await query(`DELETE FROM subjects WHERE school_id = $1::uuid`, [id]);
  await query(`DELETE FROM schools WHERE id = $1::uuid`, [id]);
  return "deleted";
}

// ─────────────────────────── Professores (só admin) ───────────────────────────

export interface TeacherEdit {
  name: string;
  email: string;
  bio?: string | null;
}

async function loadTeacher(id: string) {
  return queryOne<{ id: string; user_id: string }>(`SELECT id, user_id FROM teachers WHERE id = $1::uuid`, [id]);
}

export async function updateTeacher(actor: ScopeActor, id: string, input: TeacherEdit) {
  if (actor.role !== "admin") throw FORBIDDEN;
  const t = await loadTeacher(id);
  if (!t) throw NOT_FOUND;
  try {
    await query(`UPDATE users SET name = $2, email = $3, updated_at = now() WHERE id = $1::uuid`, [
      t.user_id,
      input.name,
      input.email.toLowerCase(),
    ]);
  } catch (err) {
    if (isDuplicate(err)) throw new RecordError(409, "Já existe um usuário com este e-mail.");
    throw err;
  }
  await query(`UPDATE teachers SET bio = $2, updated_at = now() WHERE id = $1::uuid`, [id, input.bio ?? null]);
}

export async function setTeacherActive(actor: ScopeActor, id: string, active: boolean) {
  if (actor.role !== "admin") throw FORBIDDEN;
  const t = await loadTeacher(id);
  if (!t) throw NOT_FOUND;
  await query(`UPDATE users SET active = $2, updated_at = now() WHERE id = $1::uuid`, [t.user_id, active]);
}

export async function deleteTeacher(actor: ScopeActor, id: string): Promise<DeleteResult> {
  if (actor.role !== "admin") throw FORBIDDEN;
  const t = await loadTeacher(id);
  if (!t) throw NOT_FOUND;
  const used = await count(
    `SELECT (SELECT COUNT(*) FROM classes WHERE teacher_id = $1::uuid)
          + (SELECT COUNT(*) FROM class_subject_teachers WHERE teacher_id = $1::uuid)
          + (SELECT COUNT(*) FROM council_evaluations WHERE teacher_id = $1::uuid)
          + (SELECT COUNT(*) FROM sales WHERE operator_id = $2::uuid)
          + (SELECT COUNT(*) FROM cash_registers WHERE opened_by = $2::uuid)
          + (SELECT COUNT(*) FROM inventory_movements WHERE user_id = $2::uuid)
          + (SELECT COUNT(*) FROM internal_messages WHERE sender_id = $2::uuid OR recipient_id = $2::uuid) AS n`,
    [id, t.user_id]
  );
  if (used > 0) {
    await query(`UPDATE users SET active = false, updated_at = now() WHERE id = $1::uuid`, [t.user_id]);
    return "deactivated";
  }
  await query(`DELETE FROM teachers WHERE id = $1::uuid`, [id]);
  await query(`DELETE FROM users WHERE id = $1::uuid`, [t.user_id]);
  return "deleted";
}

// ─────────────────────────── Alunos ───────────────────────────

export interface StudentEdit {
  name: string;
  email: string;
  birthDate?: string | null;
  guardianName?: string | null;
  guardianContact?: string | null;
}

async function loadStudent(id: string) {
  return queryOne<{ id: string; user_id: string; school_id: string }>(
    `SELECT id, user_id, school_id FROM students WHERE id = $1::uuid`,
    [id]
  );
}

/** Editar: admin, coordenador da escola e professor da escola. Excluir/reativar: admin e coordenador da escola. */
async function assertStudentAccess(actor: ScopeActor, school: string, forEdit: boolean) {
  if (await manageableSchool(actor, school)) return;
  if (forEdit && actor.role === "teacher" && (await getActorSchoolId(actor)) === school) return;
  throw FORBIDDEN;
}

export async function updateStudent(actor: ScopeActor, id: string, input: StudentEdit) {
  const s = await loadStudent(id);
  if (!s) throw NOT_FOUND;
  await assertStudentAccess(actor, s.school_id, true);
  try {
    await query(`UPDATE users SET name = $2, email = $3, updated_at = now() WHERE id = $1::uuid`, [
      s.user_id,
      input.name,
      input.email.toLowerCase(),
    ]);
  } catch (err) {
    if (isDuplicate(err)) throw new RecordError(409, "Já existe um usuário com este e-mail.");
    throw err;
  }
  await query(
    `UPDATE students SET birth_date = $2, guardian_name = $3, guardian_contact = $4, updated_at = now()
     WHERE id = $1::uuid`,
    [id, input.birthDate || null, input.guardianName ?? null, input.guardianContact ?? null]
  );
}

export async function setStudentActive(actor: ScopeActor, id: string, active: boolean) {
  const s = await loadStudent(id);
  if (!s) throw NOT_FOUND;
  await assertStudentAccess(actor, s.school_id, false);
  await query(`UPDATE users SET active = $2, updated_at = now() WHERE id = $1::uuid`, [s.user_id, active]);
}

export async function deleteStudent(actor: ScopeActor, id: string): Promise<DeleteResult> {
  const s = await loadStudent(id);
  if (!s) throw NOT_FOUND;
  await assertStudentAccess(actor, s.school_id, false);
  const used = await count(
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM mission_attempts WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM scores WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM student_works WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM game_attempts WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM student_activity_progress WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM council_evaluations WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM track_certificates WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM student_achievements WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM student_competencies WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM student_game_progress WHERE student_id = $1::uuid)
          + (SELECT COUNT(*) FROM sales WHERE operator_id = $2::uuid)
          + (SELECT COUNT(*) FROM internal_messages WHERE sender_id = $2::uuid OR recipient_id = $2::uuid) AS n`,
    [id, s.user_id]
  );
  if (used > 0) {
    await query(`UPDATE users SET active = false, updated_at = now() WHERE id = $1::uuid`, [s.user_id]);
    return "deactivated";
  }
  await query(`DELETE FROM students WHERE id = $1::uuid`, [id]);
  await query(`DELETE FROM users WHERE id = $1::uuid`, [s.user_id]);
  return "deleted";
}

// ─────────────────────────── Turmas ───────────────────────────

export interface ClassEdit {
  name: string;
  shift?: "manha" | "tarde" | "noite" | "integral" | null;
  schoolYear: number;
  teacherId?: string | null;
}

async function loadClass(id: string) {
  return queryOne<{ id: string; school_id: string; teacher_id: string | null }>(
    `SELECT id, school_id, teacher_id FROM classes WHERE id = $1::uuid`,
    [id]
  );
}

export async function updateClass(actor: ScopeActor, id: string, input: ClassEdit) {
  const c = await loadClass(id);
  if (!c) throw NOT_FOUND;
  let allowed = await manageableSchool(actor, c.school_id);
  if (!allowed && actor.role === "teacher") {
    const mine = await teacherIdOf(actor);
    allowed = mine !== null && c.teacher_id === mine;
  }
  if (!allowed) throw FORBIDDEN;
  if (input.teacherId) {
    const ok = await queryOne<{ id: string }>(
      `SELECT id FROM teachers WHERE id = $1::uuid AND school_id = $2::uuid`,
      [input.teacherId, c.school_id]
    );
    if (!ok) throw new RecordError(400, "O professor informado não pertence à escola desta turma.");
    // Professor não passa a turma para outra pessoa.
    if (actor.role === "teacher" && input.teacherId !== c.teacher_id) throw FORBIDDEN;
  }
  await query(
    `UPDATE classes SET name = $2, shift = $3, school_year = $4, teacher_id = $5, updated_at = now()
     WHERE id = $1::uuid`,
    [id, input.name, input.shift ?? null, input.schoolYear, input.teacherId ?? null]
  );
}

export async function setClassActive(actor: ScopeActor, id: string, active: boolean) {
  const c = await loadClass(id);
  if (!c) throw NOT_FOUND;
  if (!(await manageableSchool(actor, c.school_id))) throw FORBIDDEN;
  await query(`UPDATE classes SET active = $2, updated_at = now() WHERE id = $1::uuid`, [id, active]);
}

export async function deleteClass(actor: ScopeActor, id: string): Promise<DeleteResult> {
  const c = await loadClass(id);
  if (!c) throw NOT_FOUND;
  if (!(await manageableSchool(actor, c.school_id))) throw FORBIDDEN;
  const used = await count(
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE class_id = $1::uuid)
          + (SELECT COUNT(*) FROM class_subject_teachers WHERE class_id = $1::uuid)
          + (SELECT COUNT(*) FROM council_evaluations WHERE class_id = $1::uuid) AS n`,
    [id]
  );
  if (used > 0) {
    await query(`UPDATE classes SET active = false, updated_at = now() WHERE id = $1::uuid`, [id]);
    return "deactivated";
  }
  await query(`DELETE FROM classes WHERE id = $1::uuid`, [id]);
  return "deleted";
}
