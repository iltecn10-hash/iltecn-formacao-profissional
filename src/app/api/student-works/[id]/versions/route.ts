import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessWork } from "@/modules/student-works/access";
import { getStudentWorkById, listStudentWorkVersions } from "@/modules/student-works/queries";

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

  if (!(await canAccessWork(session, work))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const versions = await listStudentWorkVersions(id);
  return NextResponse.json({ versions });
}
