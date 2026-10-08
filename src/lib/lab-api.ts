import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { LabError } from "@/modules/lab/queries";
import type { SessionPayload } from "@/types";

/** Sessão de aluno + id do aluno, ou a resposta de erro pronta. */
export async function requireStudent(): Promise<
  { studentId: string; session: SessionPayload } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return { error: NextResponse.json({ error: "Apenas alunos podem usar esta área." }, { status: 403 }) };
  }
  const studentId = await getStudentIdByUserId(session.userId);
  if (!studentId) {
    return { error: NextResponse.json({ error: "Perfil de aluno não encontrado." }, { status: 404 }) };
  }
  return { studentId, session };
}

const STATUS: Record<LabError["code"], number> = {
  not_found: 404,
  forbidden: 403,
  locked: 423,
  incomplete: 409,
  work_required: 409,
  invalid: 400,
};

/** Mensagem de negócio (LabError) vira resposta clara; o resto, erro genérico sem vazar detalhes. */
export function labErrorResponse(err: unknown): NextResponse {
  if (err instanceof LabError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
  }
  return NextResponse.json(
    { error: "Não foi possível concluir esta operação. Tente novamente." },
    { status: 400 }
  );
}
