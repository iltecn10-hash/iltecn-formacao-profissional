import { query, queryOne } from "@/lib/db";
import { schoolScope, type ScopeActor } from "@/modules/schools/scope";
import type { SchoolClass } from "@/types";

/**
 * Turmas que ESTE usuário pode ver (escopo no SQL): admin todas; coordenador e
 * professor só as da própria escola; aluno e demais perfis, nenhuma.
 */
export async function listClasses(actor: ScopeActor): Promise<SchoolClass[]> {
  const scope = schoolScope(actor, "c.school_id");
  if (!scope) return [];
  return query<SchoolClass>(
    `SELECT c.id, c.school_id, c.teacher_id, c.name, c.shift, c.school_year, c.active,
            u.name AS teacher_name,
            COALESCE(ec.student_count, 0)::int AS student_count
     FROM classes c
     LEFT JOIN (
       SELECT class_id, COUNT(*)::int AS student_count
       FROM enrollments WHERE status = 'active' GROUP BY class_id
     ) ec ON ec.class_id = c.id
     LEFT JOIN teachers t ON t.id = c.teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     ${scope.where ? `WHERE ${scope.where}` : ""}
     ORDER BY c.school_year DESC, c.name ASC`,
    scope.params
  );
}

export interface CreateClassInput {
  name: string;
  schoolId: string;
  teacherId?: string;
  shift?: "manha" | "tarde" | "noite" | "integral";
  schoolYear: number;
}

export async function createClass(input: CreateClassInput): Promise<SchoolClass> {
  const schoolClass = await queryOne<SchoolClass>(
    `INSERT INTO classes (school_id, teacher_id, name, shift, school_year)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, school_id, teacher_id, name, shift, school_year, active`,
    [
      input.schoolId,
      input.teacherId ?? null,
      input.name,
      input.shift ?? null,
      input.schoolYear,
    ]
  );
  if (!schoolClass) throw new Error("Falha ao criar turma.");
  return schoolClass;
}

export async function enrollStudent(studentId: string, classId: string) {
  await queryOne(
    `INSERT INTO enrollments (student_id, class_id)
     VALUES ($1, $2)
     ON CONFLICT (student_id, class_id) DO NOTHING
     RETURNING id`,
    [studentId, classId]
  );
}

/** O professor (id de `teachers`) pertence a esta escola? */
export async function teacherBelongsToSchool(teacherId: string, schoolId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM teachers WHERE id = $1::uuid AND school_id = $2::uuid`,
    [teacherId, schoolId]
  );
  return row !== null;
}
