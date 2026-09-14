import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { startMissionAttempt } from "@/modules/missions/queries";

const schema = z.object({ missionId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json(
      { error: "Apenas alunos podem iniciar missões." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const studentId = await getStudentIdByUserId(session.userId);
  if (!studentId) {
    return NextResponse.json(
      { error: "Perfil de aluno não encontrado." },
      { status: 404 }
    );
  }

  await startMissionAttempt(studentId, parsed.data.missionId);
  return NextResponse.json({ success: true });
}
