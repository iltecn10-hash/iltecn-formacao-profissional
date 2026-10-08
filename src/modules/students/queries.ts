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
  /** 'kids' = aluno do ILTECN LAB. Omitido/'professional' = comportamento de sempre. */
  audience?: "professional" | "kids";
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

  // A coluna `audience` só entra no INSERT para o público infantil: o cadastro
  // profissional continua exatamente como era (e funciona mesmo antes da migration).
  const kids = input.audience === "kids";
  const student = await queryOne<Student>(
    `INSERT INTO students (user_id, school_id, birth_date, guardian_name, guardian_contact${kids ? ", audience" : ""})
     VALUES ($1, $2, $3, $4, $5${kids ? ", 'kids'" : ""})
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

/**
 * O aluno é do ILTECN LAB (público infantil)? Qualquer falha (ex.: coluna ainda
 * inexistente antes da migration) cai em "profissional" — o comportamento antigo.
 */
export async function isKidsStudent(userId: string): Promise<boolean> {
  try {
    const row = await queryOne<{ audience: string }>(`SELECT audience FROM students WHERE user_id = $1`, [userId]);
    return row?.audience === "kids";
  } catch {
    return false;
  }
}

export interface PasswordResetActor {
  userId: string;
  role: string;
}

/**
 * Redefine a senha de um ALUNO. O escopo é decidido no SQL, não na tela:
 *  - admin: qualquer aluno;
 *  - coordenador: alunos da sua escola;
 *  - professor: alunos matriculados (ativos) nas SUAS turmas;
 *  - demais perfis: ninguém.
 * Devolve o aluno afetado, ou `null` se não existe ou está fora do escopo
 * (os dois casos são indistinguíveis de propósito).
 */
export async function resetStudentPassword(
  actor: PasswordResetActor,
  studentId: string,
  newPassword: string
): Promise<{ name: string; email: string } | null> {
  let scope: string;
  let joins = "";
  const params: unknown[] = [studentId];
  if (actor.role === "admin") {
    scope = "";
  } else if (actor.role === "coordinator") {
    params.push(actor.userId);
    scope = `AND s.school_id IN (SELECT school_id FROM coordinators WHERE user_id = $2::uuid)`;
  } else if (actor.role === "teacher") {
    params.push(actor.userId);
    // JOIN em vez de subquery correlacionada (o pg-mem dos testes não resolve esta última).
    joins =
      "JOIN enrollments e ON e.student_id = s.id AND e.status = 'active' JOIN classes cl ON cl.id = e.class_id JOIN teachers t ON t.id = cl.teacher_id";
    scope = `AND t.user_id = $2::uuid`;
  } else {
    return null;
  }

  const target = await queryOne<{ user_id: string; name: string; email: string }>(
    `SELECT s.user_id, u.name, u.email
     FROM students s JOIN users u ON u.id = s.user_id ${joins}
     WHERE s.id = $1::uuid AND u.role = 'student' ${scope}
     LIMIT 1`,
    params
  );
  if (!target) return null;

  const hash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2::uuid`, [
    hash,
    target.user_id,
  ]);
  return { name: target.name, email: target.email };
}
