import { getStudentIdByUserId } from "@/modules/students/queries";
import { canActorViewStudent } from "@/modules/students/access";

/**
 * Quem pode ver/comentar/avaliar este trabalho: o aluno DONO, ou a equipe que enxerga aquele aluno
 * (admin: todos · coordenador: a escola · professor: suas turmas/vínculos).
 */
export async function canAccessWork(
  session: { userId: string; role: string },
  work: { student_id: string }
): Promise<boolean> {
  if (session.role === "student") {
    return (await getStudentIdByUserId(session.userId)) === work.student_id;
  }
  if (session.role === "admin" || session.role === "teacher" || session.role === "coordinator") {
    return canActorViewStudent({ userId: session.userId, role: session.role }, work.student_id);
  }
  return false;
}
