import { query, queryOne } from "@/lib/db";
import type { SchoolClass } from "@/types";

export async function listClasses(): Promise<SchoolClass[]> {
  return query<SchoolClass>(
    `SELECT c.id, c.school_id, c.teacher_id, c.name, c.shift, c.school_year, c.active,
            u.name AS teacher_name,
            (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.status = 'active')::int AS student_count
     FROM classes c
     LEFT JOIN teachers t ON t.id = c.teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     ORDER BY c.school_year DESC, c.name ASC`
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
