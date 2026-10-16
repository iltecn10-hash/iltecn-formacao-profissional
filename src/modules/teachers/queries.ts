import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { schoolScope, type ScopeActor } from "@/modules/schools/scope";
import type { Teacher } from "@/types";

/**
 * Professores que ESTE usuário pode ver (escopo no SQL): admin todos; coordenador e
 * professor só os da própria escola; aluno e demais perfis, nenhum.
 */
export async function listTeachers(actor: ScopeActor): Promise<Teacher[]> {
  const scope = schoolScope(actor, "t.school_id");
  if (!scope) return [];
  return query<Teacher>(
    `SELECT t.id, t.user_id, t.school_id, t.bio, u.name, u.email, u.active
     FROM teachers t
     JOIN users u ON u.id = t.user_id
     ${scope.where ? `WHERE ${scope.where}` : ""}
     ORDER BY u.name ASC`,
    scope.params
  );
}

export interface CreateTeacherInput {
  name: string;
  email: string;
  password: string;
  schoolId: string;
  bio?: string;
}

export async function createTeacher(input: CreateTeacherInput): Promise<Teacher> {
  const passwordHash = await hashPassword(input.password);

  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'teacher')
     RETURNING id`,
    [input.email.toLowerCase(), passwordHash, input.name]
  );
  if (!user) throw new Error("Falha ao criar usuário do professor.");

  const teacher = await queryOne<Teacher>(
    `INSERT INTO teachers (user_id, school_id, bio)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, school_id, bio`,
    [user.id, input.schoolId, input.bio ?? null]
  );
  if (!teacher) throw new Error("Falha ao criar professor.");

  return { ...teacher, name: input.name, email: input.email };
}
