import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { Student } from "@/types";

export async function listStudents(): Promise<Student[]> {
  return query<Student>(
    `SELECT s.id, s.user_id, s.school_id, s.birth_date, s.guardian_name,
            s.guardian_contact, s.level, s.points, u.name, u.email
     FROM students s
     JOIN users u ON u.id = s.user_id
     ORDER BY u.name ASC`
  );
}

export async function getStudentIdByUserId(userId: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM students WHERE user_id = $1`,
    [userId]
  );
  return row?.id ?? null;
}

export interface CreateStudentInput {
  name: string;
  email: string;
  password: string;
  schoolId: string;
  birthDate?: string;
  guardianName?: string;
  guardianContact?: string;
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  const passwordHash = await hashPassword(input.password);

  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'student')
     RETURNING id`,
    [input.email.toLowerCase(), passwordHash, input.name]
  );
  if (!user) throw new Error("Falha ao criar usuário do aluno.");

  const student = await queryOne<Student>(
    `INSERT INTO students (user_id, school_id, birth_date, guardian_name, guardian_contact)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, school_id, birth_date, guardian_name, guardian_contact, level, points`,
    [
      user.id,
      input.schoolId,
      input.birthDate ?? null,
      input.guardianName ?? null,
      input.guardianContact ?? null,
    ]
  );
  if (!student) throw new Error("Falha ao criar aluno.");

  return { ...student, name: input.name, email: input.email };
}
