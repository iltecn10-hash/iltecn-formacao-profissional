import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { listEvaluationEvents } from "@/modules/council/evaluations";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const events = await listEvaluationEvents(auth.actor, id);
    if (!events) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    return NextResponse.json({ events });
  } catch (e) { return mapError(e); }
}
