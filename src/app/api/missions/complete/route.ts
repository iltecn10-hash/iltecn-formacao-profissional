import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { completeMissionAttempt } from "@/modules/missions/queries";

const schema = z.object({
  missionId: z.string().uuid(),
  submissionUrl: z.string().url("Link inválido.").optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json(
      { error: "Apenas alunos podem concluir missões." },
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

  try {
    await completeMissionAttempt(
      studentId,
      parsed.data.missionId,
      parsed.data.submissionUrl || undefined
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Verifique os dados e tente novamente." },
      { status: 400 }
    );
  }
}
