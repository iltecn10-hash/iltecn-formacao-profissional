import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import type { UserRole } from "@/types";

export interface UserActor {
  userId: string;
  role: UserRole;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

/**
 * Escopo (no SQL) das contas que o ator pode ver e cujas senhas pode redefinir:
 * admin = todas; coordenador = professores e alunos da sua escola; professor = alunos com
 * matrícula ativa nas suas turmas; aluno e demais = nenhuma. Só IN com subconsultas
 * independentes (o pg-mem dos testes não resolve subconsulta correlacionada).
 */
function userScope(actor: UserActor): { where: string; params: unknown[] } | null {
  if (actor.role === "admin") return { where: "TRUE", params: [] };
  if (actor.role === "coordinator") {
    return {
      where: `u.id IN (SELECT user_id FROM teachers WHERE school_id IN
                (SELECT school_id FROM coordinators WHERE user_id = $1::uuid))
              OR u.id IN (SELECT user_id FROM students WHERE school_id IN
                (SELECT school_id FROM coordinators WHERE user_id = $1::uuid))`,
      params: [actor.userId],
    };
  }
  if (actor.role === "teacher") {
    return {
      where: `u.id IN (SELECT s.user_id FROM students s
                JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
                JOIN classes cl ON cl.id = e.class_id
                JOIN teachers t ON t.id = cl.teacher_id
                WHERE t.user_id = $1::uuid)`,
      params: [actor.userId],
    };
  }
  return null;
}

export async function listManagedUsers(actor: UserActor): Promise<ManagedUser[]> {
  const scope = userScope(actor);
  if (!scope) return [];
  return query<ManagedUser>(
    `SELECT u.id, u.name, u.email, u.role, u.active
     FROM users u WHERE ${scope.where}
     ORDER BY u.role ASC, u.name ASC`,
    scope.params
  );
}

/** Redefine a senha de uma conta DENTRO do escopo do ator; fora dele devolve null (404). */
export async function resetUserPassword(
  actor: UserActor,
  targetUserId: string,
  newPassword: string
): Promise<{ name: string; email: string; role: UserRole } | null> {
  const scope = userScope(actor);
  if (!scope) return null;
  const n = scope.params.length + 1;
  const target = await queryOne<{ id: string; name: string; email: string; role: UserRole }>(
    `SELECT u.id, u.name, u.email, u.role FROM users u
     WHERE u.id = $${n}::uuid AND (${scope.where}) LIMIT 1`,
    [...scope.params, targetUserId]
  );
  if (!target) return null;
  const hash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2::uuid`, [
    hash,
    target.id,
  ]);
  return { name: target.name, email: target.email, role: target.role };
}

export type ChangePasswordResult = "ok" | "wrong_current" | "same_password" | "not_found";

/** Troca da própria senha: exige a senha atual. */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const user = await queryOne<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1::uuid AND active = true`,
    [userId]
  );
  if (!user) return "not_found";
  if (!(await verifyPassword(currentPassword, user.password_hash))) return "wrong_current";
  if (currentPassword === newPassword) return "same_password";
  const hash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2::uuid`, [
    hash,
    userId,
  ]);
  return "ok";
}
