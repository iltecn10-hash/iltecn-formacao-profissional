import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getStudentReport } from "@/modules/reports/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  // Aluno só pode ver o próprio relatório; demais perfis podem ver qualquer um.
  if (session.role === "student") {
    const ownStudentId = await getStudentIdByUserId(session.userId);
    if (ownStudentId !== id) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  }

  const report = await getStudentReport(id);
  if (!report) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ report });
}
