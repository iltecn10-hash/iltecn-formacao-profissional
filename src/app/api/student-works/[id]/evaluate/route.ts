import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  recordManualEvaluation,
  WorkNotSubmittedError,
} from "@/modules/student-works/queries";

const STAFF_ROLES = ["admin", "teacher", "coordinator"] as const;

const evaluateSchema = z.object({
  passed: z.boolean(),
  score: z.number().int().min(0).max(100).optional(),
  feedback: z.string().trim().max(4000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !STAFF_ROLES.includes(session.role as (typeof STAFF_ROLES)[number])) {
    return NextResponse.json(
      { error: "Apenas professores, coordenadores ou administradores podem avaliar trabalhos." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = evaluateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  try {
    const evaluation = await recordManualEvaluation(id, session.userId, parsed.data);
    return NextResponse.json({ evaluation }, { status: 201 });
  } catch (err) {
    if (err instanceof WorkNotSubmittedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Não foi possível registrar a avaliação." },
      { status: 400 }
    );
  }
}
