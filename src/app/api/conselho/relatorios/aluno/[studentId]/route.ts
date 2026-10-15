import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { getStudentCouncilReport } from "@/modules/council/evaluations";

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { studentId } = await params;
  if (!z.string().uuid().safeParse(studentId).success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const report = await getStudentCouncilReport(auth.actor, studentId);
    if (!report) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
    return NextResponse.json({ report });
  } catch (e) { return mapError(e); }
}
