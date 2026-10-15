import { queryOne } from "@/lib/db";
import type { ScopeActor } from "@/modules/schools/scope";

export interface StudentScope { where: string; params: unknown[] }

/**
 * Quais ALUNOS o ator pode ver — decidido no SQL (mesmo critério do LAB e da redefinição de senha):
 *  - admin: todos;
 *  - coordenador: alunos da escola do seu cadastro;
 *  - professor: alunos com matrícula ATIVA em turma pela qual é responsável OU em turma onde tem
 *    vínculo ativo de disciplina (Conselho de Classe);
 *  - aluno e demais perfis: `null` (ninguém).
 * `column` é um identificador FIXO do código chamador (ex.: "s.id"), nunca valor do usuário.
 */
export function studentScope(actor: ScopeActor, column: string, startAt = 1): StudentScope | null {
  const n = `$${startAt}::uuid`;
  if (actor.role === "admin") return { where: "", params: [] };
  if (actor.role === "coordinator")
    return {
      where: `${column} IN (SELECT sc.id FROM students sc WHERE sc.school_id IN
                (SELECT school_id FROM coordinators WHERE user_id = ${n}))`,
      params: [actor.userId],
    };
  if (actor.role === "teacher")
    return {
      where: `${column} IN (SELECT en.student_id FROM enrollments en WHERE en.status = 'active' AND en.class_id IN
                (SELECT cl.id FROM classes cl WHERE cl.teacher_id IN (SELECT id FROM teachers WHERE user_id = ${n})
                 UNION
                 SELECT cst.class_id FROM class_subject_teachers cst
                   JOIN teachers tt ON tt.id = cst.teacher_id
                  WHERE tt.user_id = ${n} AND cst.active = true))`,
      params: [actor.userId],
    };
  return null;
}

/** O ator (admin/professor/coordenador) pode ver os dados deste aluno? */
export async function canActorViewStudent(actor: ScopeActor, studentId: string): Promise<boolean> {
  const scope = studentScope(actor, "st.id", 2);
  if (!scope) return false;
  const row = await queryOne<{ ok: number }>(
    `SELECT 1 AS ok FROM students st WHERE st.id = $1::uuid ${scope.where ? `AND ${scope.where}` : ""}`,
    [studentId, ...scope.params]);
  return !!row;
}
