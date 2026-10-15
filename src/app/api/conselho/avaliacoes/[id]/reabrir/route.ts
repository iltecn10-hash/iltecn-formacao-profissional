import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { reopenEvaluation } from "@/modules/council/evaluations";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = z.object({ reason: z.string().min(3).max(500) }).safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success)
    return NextResponse.json({ error: "Informe o motivo da reabertura." }, { status: 400 });
  try {
    const evaluation = await reopenEvaluation(auth.actor, id, body.data.reason);
    if (!evaluation) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    return NextResponse.json({ evaluation });
  } catch (e) { return mapError(e); }
}
