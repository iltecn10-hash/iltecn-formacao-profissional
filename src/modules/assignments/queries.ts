import { query, queryOne } from "@/lib/db";
import { RecordError } from "@/modules/registry/records";
import { getActorSchoolId, type ScopeActor } from "@/modules/schools/scope";
import type { UploadedFile } from "@/lib/uploads";

/**
 * Atividades da turma. Regras (todas no servidor):
 * - criar/editar/avaliar: admin, ou o professor da turma (responsável ou com vínculo de disciplina ativo);
 * - coordenador: só consulta as atividades da sua escola;
 * - aluno: só vê as atividades das turmas em que tem matrícula ativa e só mexe na própria entrega.
 */

const FORBIDDEN = new RecordError(403, "Você não tem permissão para esta ação.");
const NOT_FOUND = new RecordError(404, "Atividade não encontrada.");

/** O driver devolve DATE como Date (meia-noite local); a tela usa 'AAAA-MM-DD'. */
function dateOnly(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.slice(0, 10);
  const d = v as Date;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface FileMeta {
  id: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  school_id: string;
  class_id: string;
  class_name: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  max_score: number;
  closed: boolean;
  created_at: string;
}

async function teacherIdOf(userId: string): Promise<string | null> {
  const r = await queryOne<{ id: string }>(`SELECT id FROM teachers WHERE user_id = $1::uuid`, [userId]);
  return r?.id ?? null;
}

/** Pode gerenciar (criar/editar/avaliar) atividades desta turma? */
export async function canManageClass(actor: ScopeActor, classId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "teacher") return false;
  const tid = await teacherIdOf(actor.userId);
  if (!tid) return false;
  const own = await queryOne<{ id: string }>(`SELECT id FROM classes WHERE id = $1::uuid AND teacher_id = $2::uuid`, [classId, tid]);
  if (own) return true;
  const link = await queryOne<{ id: string }>(
    `SELECT id FROM class_subject_teachers WHERE class_id = $1::uuid AND teacher_id = $2::uuid AND active = true`,
    [classId, tid]
  );
  return !!link;
}

async function studentIdOf(userId: string): Promise<string | null> {
  const r = await queryOne<{ id: string }>(`SELECT id FROM students WHERE user_id = $1::uuid`, [userId]);
  return r?.id ?? null;
}

async function isEnrolled(studentId: string, classId: string): Promise<boolean> {
  const r = await queryOne<{ id: string }>(
    `SELECT id FROM enrollments WHERE student_id = $1::uuid AND class_id = $2::uuid AND status = 'active'`,
    [studentId, classId]
  );
  return !!r;
}

const SELECT_ASSIGNMENT = `SELECT a.id, a.school_id, a.class_id, c.name AS class_name, a.title, a.instructions,
       a.due_date, a.max_score::float AS max_score, a.closed, a.created_at
  FROM assignments a JOIN classes c ON c.id = a.class_id`;

export type AccessLevel = "manage" | "view" | "student";

/** Carrega a atividade e diz o que este ator pode fazer com ela (null = sem acesso/inexistente). */
export async function getAssignmentAccess(
  actor: ScopeActor,
  id: string
): Promise<{ assignment: AssignmentRow; level: AccessLevel; studentId: string | null } | null> {
  const raw = await queryOne<AssignmentRow>(`${SELECT_ASSIGNMENT} WHERE a.id = $1::uuid`, [id]);
  if (!raw) return null;
  const assignment = { ...raw, due_date: dateOnly(raw.due_date) };
  if (await canManageClass(actor, assignment.class_id)) return { assignment, level: "manage", studentId: null };
  if (actor.role === "coordinator" && (await getActorSchoolId(actor)) === assignment.school_id) {
    return { assignment, level: "view", studentId: null };
  }
  if (actor.role === "student") {
    const sid = await studentIdOf(actor.userId);
    if (sid && (await isEnrolled(sid, assignment.class_id))) return { assignment, level: "student", studentId: sid };
  }
  return null;
}

// ─────────────────────────── Professor ───────────────────────────

async function insertFiles(
  assignmentId: string,
  submissionId: string | null,
  kind: "material" | "delivery",
  uploadedBy: string,
  files: UploadedFile[]
) {
  for (const f of files) {
    await query(
      `INSERT INTO assignment_files (assignment_id, submission_id, kind, file_name, mime_type, size_bytes, data, uploaded_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)`,
      [assignmentId, submissionId, kind, f.name, f.mime, f.size, f.data, uploadedBy]
    );
  }
}

export interface AssignmentInput {
  classId: string;
  title: string;
  instructions?: string | null;
  dueDate?: string | null;
  maxScore?: number;
}

export async function createAssignment(actor: ScopeActor, input: AssignmentInput, files: UploadedFile[]) {
  const cls = await queryOne<{ id: string; school_id: string; active: boolean }>(
    `SELECT id, school_id, active FROM classes WHERE id = $1::uuid`,
    [input.classId]
  );
  if (!cls) throw new RecordError(400, "Turma inválida.");
  if (!(await canManageClass(actor, cls.id))) throw FORBIDDEN;
  if (!cls.active) throw new RecordError(409, "Esta turma está desativada.");
  const row = await queryOne<{ id: string }>(
    `INSERT INTO assignments (school_id, class_id, created_by, title, instructions, due_date, max_score)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7) RETURNING id`,
    [cls.school_id, cls.id, actor.userId, input.title, input.instructions ?? null, input.dueDate ?? null, input.maxScore ?? 10]
  );
  if (!row) throw new Error("Falha ao criar a atividade.");
  await insertFiles(row.id, null, "material", actor.userId, files);
  return row;
}

export async function updateAssignment(
  actor: ScopeActor,
  id: string,
  input: { title: string; instructions?: string | null; dueDate?: string | null }
) {
  const acc = await getAssignmentAccess(actor, id);
  if (!acc) throw NOT_FOUND;
  if (acc.level !== "manage") throw FORBIDDEN;
  await query(
    `UPDATE assignments SET title = $2, instructions = $3, due_date = $4, updated_at = now() WHERE id = $1::uuid`,
    [id, input.title, input.instructions ?? null, input.dueDate ?? null]
  );
}

export async function setAssignmentClosed(actor: ScopeActor, id: string, closed: boolean) {
  const acc = await getAssignmentAccess(actor, id);
  if (!acc) throw NOT_FOUND;
  if (acc.level !== "manage") throw FORBIDDEN;
  await query(`UPDATE assignments SET closed = $2, updated_at = now() WHERE id = $1::uuid`, [id, closed]);
}

/** Sem entregas: apaga de vez (com os materiais). Com entregas: só ENCERRA (o histórico fica). */
export async function deleteAssignment(actor: ScopeActor, id: string): Promise<"deleted" | "deactivated"> {
  const acc = await getAssignmentAccess(actor, id);
  if (!acc) throw NOT_FOUND;
  if (acc.level !== "manage") throw FORBIDDEN;
  const n = await queryOne<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM assignment_submissions WHERE assignment_id = $1::uuid`,
    [id]
  );
  if (Number(n?.n ?? 0) > 0) {
    await query(`UPDATE assignments SET closed = true, updated_at = now() WHERE id = $1::uuid`, [id]);
    return "deactivated";
  }
  await query(`DELETE FROM assignment_files WHERE assignment_id = $1::uuid`, [id]);
  await query(`DELETE FROM assignments WHERE id = $1::uuid`, [id]);
  return "deleted";
}

export interface AssignmentSummary extends AssignmentRow {
  total_students: number;
  delivered: number;
}

export async function listAssignmentsForStaff(actor: ScopeActor): Promise<AssignmentSummary[]> {
  let where: string;
  const params: unknown[] = [];
  if (actor.role === "admin") {
    where = "TRUE";
  } else if (actor.role === "coordinator") {
    where = `a.school_id IN (SELECT school_id FROM coordinators WHERE user_id = $1::uuid)`;
    params.push(actor.userId);
  } else if (actor.role === "teacher") {
    where = `(a.class_id IN (SELECT id FROM classes WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = $1::uuid))
           OR a.class_id IN (SELECT class_id FROM class_subject_teachers WHERE active = true
                              AND teacher_id IN (SELECT id FROM teachers WHERE user_id = $1::uuid)))`;
    params.push(actor.userId);
  } else {
    return [];
  }
  const rows = (await query<AssignmentRow>(`${SELECT_ASSIGNMENT} WHERE ${where} ORDER BY a.created_at DESC`, params)).map(
    (r) => ({ ...r, due_date: dateOnly(r.due_date) })
  );
  if (rows.length === 0) return [];
  const totals = await query<{ class_id: string; n: number | string }>(
    `SELECT class_id, COUNT(*) AS n FROM enrollments WHERE status = 'active' GROUP BY class_id`
  );
  const delivered = await query<{ assignment_id: string; n: number | string }>(
    `SELECT assignment_id, COUNT(*) AS n FROM assignment_submissions GROUP BY assignment_id`
  );
  const tMap = new Map(totals.map((t) => [t.class_id, Number(t.n)]));
  const dMap = new Map(delivered.map((d) => [d.assignment_id, Number(d.n)]));
  return rows.map((r) => ({ ...r, total_students: tMap.get(r.class_id) ?? 0, delivered: dMap.get(r.id) ?? 0 }));
}

// ─────────────────────────── Aluno ───────────────────────────

export interface StudentAssignmentRow extends AssignmentRow {
  submission_status: "submitted" | "returned" | "evaluated" | null;
  score: number | null;
}

export async function listAssignmentsForStudent(userId: string): Promise<StudentAssignmentRow[]> {
  const sid = await studentIdOf(userId);
  if (!sid) return [];
  const rows = await query<StudentAssignmentRow>(
    `SELECT a.id, a.school_id, a.class_id, c.name AS class_name, a.title, a.instructions,
            a.due_date, a.max_score::float AS max_score, a.closed, a.created_at,
            s.status AS submission_status, s.score::float AS score
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       JOIN enrollments e ON e.class_id = a.class_id AND e.student_id = $1::uuid AND e.status = 'active'
       LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = $1::uuid
      ORDER BY a.created_at DESC`,
    [sid]
  );
  return rows.map((r) => ({ ...r, due_date: dateOnly(r.due_date) }));
}

export async function listMaterials(assignmentId: string): Promise<FileMeta[]> {
  return query<FileMeta>(
    `SELECT id, file_name, size_bytes, created_at FROM assignment_files
      WHERE assignment_id = $1::uuid AND kind = 'material' ORDER BY created_at ASC`,
    [assignmentId]
  );
}

export interface SubmissionRow {
  id: string;
  student_id: string;
  student_name: string;
  comment: string | null;
  status: "submitted" | "returned" | "evaluated";
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  late: boolean;
  files: FileMeta[];
}

function isLate(dueDate: string | null, submittedAt: string | Date): boolean {
  if (!dueDate) return false;
  const limit = new Date(`${dueDate}T23:59:59-03:00`).getTime();
  return new Date(submittedAt).getTime() > limit;
}

async function filesBySubmission(assignmentId: string) {
  const files = await query<FileMeta & { submission_id: string }>(
    `SELECT id, submission_id, file_name, size_bytes, created_at FROM assignment_files
      WHERE assignment_id = $1::uuid AND kind = 'delivery' ORDER BY created_at ASC`,
    [assignmentId]
  );
  const map = new Map<string, FileMeta[]>();
  for (const f of files) map.set(f.submission_id, [...(map.get(f.submission_id) ?? []), f]);
  return map;
}

export async function getMySubmission(assignment: AssignmentRow, studentId: string): Promise<SubmissionRow | null> {
  const all = await listSubmissions(assignment, studentId);
  return all[0] ?? null;
}

/** Entregas da atividade (equipe vê todas; com studentId, só a desse aluno). */
export async function listSubmissions(assignment: AssignmentRow, onlyStudentId?: string): Promise<SubmissionRow[]> {
  const rows = await query<Omit<SubmissionRow, "files" | "late">>(
    `SELECT s.id, s.student_id, u.name AS student_name, s.comment, s.status, s.score::float AS score,
            s.feedback, s.submitted_at
       FROM assignment_submissions s
       JOIN students st ON st.id = s.student_id
       JOIN users u ON u.id = st.user_id
      WHERE s.assignment_id = $1::uuid ${onlyStudentId ? "AND s.student_id = $2::uuid" : ""}
      ORDER BY u.name ASC`,
    onlyStudentId ? [assignment.id, onlyStudentId] : [assignment.id]
  );
  const files = await filesBySubmission(assignment.id);
  return rows.map((r) => ({ ...r, late: isLate(assignment.due_date, r.submitted_at), files: files.get(r.id) ?? [] }));
}

/** Alunos da turma que ainda não entregaram. */
export async function listPendingStudents(assignment: AssignmentRow): Promise<{ id: string; name: string }[]> {
  const enrolled = await query<{ id: string; name: string }>(
    `SELECT st.id, u.name FROM enrollments e
       JOIN students st ON st.id = e.student_id
       JOIN users u ON u.id = st.user_id
      WHERE e.class_id = $1::uuid AND e.status = 'active' ORDER BY u.name ASC`,
    [assignment.class_id]
  );
  const done = await query<{ student_id: string }>(
    `SELECT student_id FROM assignment_submissions WHERE assignment_id = $1::uuid`,
    [assignment.id]
  );
  const set = new Set(done.map((d) => d.student_id));
  return enrolled.filter((s) => !set.has(s.id));
}

export async function submitAssignment(
  actor: ScopeActor,
  assignmentId: string,
  comment: string | null,
  files: UploadedFile[]
) {
  if (actor.role !== "student") throw FORBIDDEN;
  const acc = await getAssignmentAccess(actor, assignmentId);
  if (!acc || acc.level !== "student" || !acc.studentId) throw NOT_FOUND;
  if (acc.assignment.closed) throw new RecordError(409, "Esta atividade foi encerrada pelo professor.");

  const existing = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM assignment_submissions WHERE assignment_id = $1::uuid AND student_id = $2::uuid`,
    [assignmentId, acc.studentId]
  );
  if (existing?.status === "evaluated") {
    throw new RecordError(409, "Sua entrega já foi avaliada. Fale com o professor se precisar enviar de novo.");
  }
  if (!existing && files.length === 0) throw new RecordError(400, "Anexe pelo menos um arquivo para entregar.");

  let submissionId: string;
  if (existing) {
    submissionId = existing.id;
    await query(
      `UPDATE assignment_submissions SET comment = $2, status = 'submitted', submitted_at = now() WHERE id = $1::uuid`,
      [submissionId, comment]
    );
    if (files.length > 0) await query(`DELETE FROM assignment_files WHERE submission_id = $1::uuid`, [submissionId]);
  } else {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO assignment_submissions (assignment_id, student_id, comment) VALUES ($1::uuid, $2::uuid, $3) RETURNING id`,
      [assignmentId, acc.studentId, comment]
    );
    if (!row) throw new Error("Falha ao registrar a entrega.");
    submissionId = row.id;
  }
  await insertFiles(assignmentId, submissionId, "delivery", actor.userId, files);
  return { id: submissionId };
}

export async function evaluateSubmission(
  actor: ScopeActor,
  submissionId: string,
  input: { status: "evaluated" | "returned"; score?: number | null; feedback?: string | null }
) {
  const sub = await queryOne<{ id: string; assignment_id: string }>(
    `SELECT id, assignment_id FROM assignment_submissions WHERE id = $1::uuid`,
    [submissionId]
  );
  if (!sub) throw new RecordError(404, "Entrega não encontrada.");
  const acc = await getAssignmentAccess(actor, sub.assignment_id);
  if (!acc) throw new RecordError(404, "Entrega não encontrada.");
  if (acc.level !== "manage") throw FORBIDDEN;
  if (input.score != null && (input.score < 0 || input.score > acc.assignment.max_score)) {
    throw new RecordError(400, `A nota deve ficar entre 0 e ${acc.assignment.max_score}.`);
  }
  await query(
    `UPDATE assignment_submissions
        SET status = $2, score = $3, feedback = $4, evaluated_at = now(), evaluated_by = $5::uuid
      WHERE id = $1::uuid`,
    [submissionId, input.status, input.score ?? null, input.feedback ?? null, actor.userId]
  );
}

// ─────────────────────────── Download ───────────────────────────

export interface FileDownload {
  file_name: string;
  mime_type: string;
  data: Buffer;
}

/** Devolve o arquivo só se o ator pode vê-lo (aluno: material da própria turma ou a própria entrega). */
export async function getFileForDownload(actor: ScopeActor, fileId: string): Promise<FileDownload | null> {
  const f = await queryOne<FileDownload & { assignment_id: string; kind: string; submission_id: string | null }>(
    `SELECT file_name, mime_type, data, assignment_id, kind, submission_id FROM assignment_files WHERE id = $1::uuid`,
    [fileId]
  );
  if (!f) return null;
  const acc = await getAssignmentAccess(actor, f.assignment_id);
  if (!acc) return null;
  if (f.kind === "delivery" && acc.level === "student") {
    const own = await queryOne<{ id: string }>(
      `SELECT id FROM assignment_submissions WHERE id = $1::uuid AND student_id = $2::uuid`,
      [f.submission_id, acc.studentId]
    );
    if (!own) return null;
  }
  return { file_name: f.file_name, mime_type: f.mime_type, data: Buffer.from(f.data) };
}

/** Turmas ativas em que o ator pode criar atividades (admin: todas; professor: as suas). */
export async function listManageableClasses(actor: ScopeActor): Promise<{ id: string; name: string }[]> {
  if (actor.role === "admin") {
    return query<{ id: string; name: string }>(`SELECT id, name FROM classes WHERE active = true ORDER BY name ASC`);
  }
  if (actor.role !== "teacher") return [];
  return query<{ id: string; name: string }>(
    `SELECT id, name FROM classes
      WHERE active = true AND (
        teacher_id IN (SELECT id FROM teachers WHERE user_id = $1::uuid)
        OR id IN (SELECT class_id FROM class_subject_teachers WHERE active = true
                   AND teacher_id IN (SELECT id FROM teachers WHERE user_id = $1::uuid)))
      ORDER BY name ASC`,
    [actor.userId]
  );
}

export interface StudentDelivery {
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  class_name: string;
  status: "submitted" | "returned" | "evaluated";
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  late: boolean;
  files: FileMeta[];
}

/**
 * Tudo o que um aluno entregou, para a ficha dele. Quem consulta só enxerga as entregas das
 * atividades que PODE acessar (professor: as das suas turmas; coordenador: as da escola; admin: todas).
 */
export async function listDeliveriesForStudent(actor: ScopeActor, studentId: string): Promise<StudentDelivery[]> {
  const subs = await query<{ id: string; assignment_id: string }>(
    `SELECT id, assignment_id FROM assignment_submissions WHERE student_id = $1::uuid ORDER BY submitted_at DESC`,
    [studentId]
  );
  const out: StudentDelivery[] = [];
  for (const s of subs) {
    const acc = await getAssignmentAccess(actor, s.assignment_id);
    if (!acc || acc.level === "student") continue;
    const [one] = await listSubmissions(acc.assignment, studentId);
    if (!one) continue;
    out.push({
      submission_id: one.id,
      assignment_id: acc.assignment.id,
      assignment_title: acc.assignment.title,
      class_name: acc.assignment.class_name,
      status: one.status,
      score: one.score,
      feedback: one.feedback,
      submitted_at: one.submitted_at,
      late: one.late,
      files: one.files,
    });
  }
  return out;
}
