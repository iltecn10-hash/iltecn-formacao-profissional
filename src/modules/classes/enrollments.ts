import { query, queryOne } from "@/lib/db";
import { RecordError } from "@/modules/registry/records";
import { getActorSchoolId, type ScopeActor } from "@/modules/schools/scope";

const FORBIDDEN = new RecordError(403, "Você não tem permissão para matricular alunos nesta turma.");
const NOT_FOUND = new RecordError(404, "Turma não encontrada.");

interface ClassRow {
  id: string;
  name: string;
  school_id: string;
  teacher_id: string | null;
  active: boolean;
}

async function loadClass(id: string): Promise<ClassRow | null> {
  return queryOne<ClassRow>(`SELECT id, name, school_id, teacher_id, active FROM classes WHERE id = $1::uuid`, [id]);
}

/** Admin: qualquer turma · coordenador/diretor: turmas da escola · professor: só a turma pela qual é responsável. */
async function assertCanManage(actor: ScopeActor, cls: ClassRow) {
  if (actor.role === "admin") return;
  if (actor.role === "coordinator") {
    if ((await getActorSchoolId(actor)) === cls.school_id) return;
    throw FORBIDDEN;
  }
  if (actor.role === "teacher") {
    const t = await queryOne<{ id: string }>(`SELECT id FROM teachers WHERE user_id = $1::uuid`, [actor.userId]);
    if (t && cls.teacher_id === t.id) return;
  }
  throw FORBIDDEN;
}

export interface EnrollmentPerson {
  student_id: string;
  name: string;
  email: string;
}

export interface ClassRoster {
  class: { id: string; name: string; active: boolean };
  enrolled: EnrollmentPerson[];
  available: EnrollmentPerson[];
}

export async function getClassRoster(actor: ScopeActor, classId: string): Promise<ClassRoster> {
  const cls = await loadClass(classId);
  if (!cls) throw NOT_FOUND;
  await assertCanManage(actor, cls);
  const enrolled = await query<EnrollmentPerson>(
    `SELECT s.id AS student_id, u.name, u.email
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
      WHERE e.class_id = $1::uuid AND e.status = 'active'
      ORDER BY u.name ASC`,
    [classId]
  );
  const enrolledIds = new Set(enrolled.map((e) => e.student_id));
  const candidates = await query<EnrollmentPerson>(
    `SELECT s.id AS student_id, u.name, u.email
       FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.school_id = $1::uuid AND u.active = true
      ORDER BY u.name ASC`,
    [cls.school_id]
  );
  return {
    class: { id: cls.id, name: cls.name, active: cls.active },
    enrolled,
    available: candidates.filter((c) => !enrolledIds.has(c.student_id)),
  };
}

export async function enrollInClass(actor: ScopeActor, classId: string, studentId: string) {
  const cls = await loadClass(classId);
  if (!cls) throw NOT_FOUND;
  await assertCanManage(actor, cls);
  if (!cls.active) throw new RecordError(409, "Esta turma está desativada.");
  const st = await queryOne<{ school_id: string; active: boolean }>(
    `SELECT s.school_id, u.active FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1::uuid`,
    [studentId]
  );
  if (!st) throw new RecordError(404, "Aluno não encontrado.");
  if (st.school_id !== cls.school_id) throw new RecordError(400, "O aluno precisa ser da mesma escola da turma.");
  if (!st.active) throw new RecordError(409, "Este aluno está desativado.");
  // Já matriculado antes e removido? Reativa a mesma matrícula (histórico preservado).
  await query(
    `INSERT INTO enrollments (student_id, class_id, status) VALUES ($1::uuid, $2::uuid, 'active')
     ON CONFLICT (student_id, class_id) DO UPDATE SET status = 'active'`,
    [studentId, classId]
  );
}

/** Remover = marcar a matrícula como inativa (notas e entregas do aluno continuam guardadas). */
export async function unenrollFromClass(actor: ScopeActor, classId: string, studentId: string) {
  const cls = await loadClass(classId);
  if (!cls) throw NOT_FOUND;
  await assertCanManage(actor, cls);
  await query(
    `UPDATE enrollments SET status = 'inactive' WHERE class_id = $1::uuid AND student_id = $2::uuid`,
    [classId, studentId]
  );
}
