import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getStudentWorkById, listWorkEvaluations } from "@/modules/student-works/queries";

const STAFF_ROLES = ["admin", "teacher", "coordinator"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const work = await getStudentWorkById(id);
  if (!work) {
    return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  }

  if (session.role === "student") {
    const ownStudentId = await getStudentIdByUserId(session.userId);
    if (ownStudentId !== work.student_id) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  } else if (!STAFF_ROLES.includes(session.role as (typeof STAFF_ROLES)[number])) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const evaluations = await listWorkEvaluations(id);
  return NextResponse.json({ evaluations });
}
