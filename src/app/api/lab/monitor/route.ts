import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getLabMonitor } from "@/modules/lab/monitor";

const STAFF = ["admin", "teacher", "coordinator"];

/** Painel do professor/escola (consultado em intervalo pela tela). Escopo aplicado no SQL. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !STAFF.includes(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const classId = request.nextUrl.searchParams.get("classId") ?? undefined;
  if (classId && !z.string().uuid().safeParse(classId).success) {
    return NextResponse.json({ error: "Turma inválida." }, { status: 400 });
  }
  const data = await getLabMonitor({ userId: session.userId, role: session.role }, { classId });
  return NextResponse.json(data);
}
