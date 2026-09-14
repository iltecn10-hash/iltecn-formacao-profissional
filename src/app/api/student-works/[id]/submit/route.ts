import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { submitStudentWork } from "@/modules/student-works/queries";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json(
      { error: "Apenas o aluno dono do trabalho pode entregá-lo." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const studentId = await getStudentIdByUserId(session.userId);
  if (!studentId) {
    return NextResponse.json({ error: "Perfil de aluno não encontrado." }, { status: 404 });
  }

  try {
    const work = await submitStudentWork(id, studentId);
    return NextResponse.json({ work });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível entregar este trabalho." },
      { status: 400 }
    );
  }
}
