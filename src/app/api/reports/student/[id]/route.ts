import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getStudentReport } from "@/modules/reports/queries";
import { canActorViewStudent } from "@/modules/students/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  // Aluno só vê o próprio relatório; a equipe só vê alunos do seu escopo (admin: todos ·
  // coordenador: a escola · professor: suas turmas/vínculos).
  if (session.role === "student") {
    const ownStudentId = await getStudentIdByUserId(session.userId);
    if (ownStudentId !== id) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  } else if (!(await canActorViewStudent({ userId: session.userId, role: session.role }, id))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const report = await getStudentReport(id);
  if (!report) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ report });
}
