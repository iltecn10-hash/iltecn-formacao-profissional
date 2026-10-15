import { queryOne } from "@/lib/db";
import type { UserRole } from "@/types";

/** Quem está pedindo: sempre vem da sessão no servidor, nunca do corpo da requisição. */
export interface ScopeActor {
  userId: string;
  role: UserRole;
}

export interface SchoolScope {
  /** Condição SQL pronta para entrar num WHERE (vazia = sem restrição, só admin). */
  where: string;
  params: unknown[];
}

/**
 * Escopo por ESCOLA para listagens da equipe — decidido no SQL, não na tela:
 *  - admin: todas as escolas;
 *  - coordenador: a escola do seu cadastro (sem escola = nada);
 *  - professor: a escola do seu cadastro;
 *  - aluno e demais perfis: `null` (ninguém vê nada).
 *
 * `column` é um identificador FIXO escrito pelo código chamador (ex.: "s.school_id"),
 * nunca um valor vindo do usuário. `startAt` é o próximo número de parâmetro livre.
 */
export function schoolScope(
  actor: ScopeActor,
  column: string,
  startAt = 1
): SchoolScope | null {
  if (actor.role === "admin") return { where: "", params: [] };
  if (actor.role === "coordinator") {
    return {
      where: `${column} IN (SELECT school_id FROM coordinators WHERE user_id = $${startAt}::uuid)`,
      params: [actor.userId],
    };
  }
  if (actor.role === "teacher") {
    return {
      where: `${column} IN (SELECT school_id FROM teachers WHERE user_id = $${startAt}::uuid)`,
      params: [actor.userId],
    };
  }
  return null;
}

/** Escola do cadastro de professor/coordenador (null se não houver ou se for outro perfil). */
export async function getActorSchoolId(actor: ScopeActor): Promise<string | null> {
  if (actor.role !== "teacher" && actor.role !== "coordinator") return null;
  const table = actor.role === "teacher" ? "teachers" : "coordinators";
  const row = await queryOne<{ school_id: string | null }>(
    `SELECT school_id FROM ${table} WHERE user_id = $1::uuid`,
    [actor.userId]
  );
  return row?.school_id ?? null;
}

/**
 * O ator pode CRIAR registros nesta escola? Admin: qualquer uma. Professor: só a própria.
 * Os demais perfis não criam (as rotas já os barram antes).
 */
export async function canActorUseSchool(actor: ScopeActor, schoolId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "teacher") return false;
  return (await getActorSchoolId(actor)) === schoolId;
}
