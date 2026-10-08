import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { labErrorResponse } from "@/lib/lab-api";
import { activityInputSchema, deactivateActivity, updateActivity } from "@/modules/lab/content";

async function adminOnly() {
  const session = await getSession();
  return session?.role === "admin"
    ? null
    : NextResponse.json({ error: "Apenas administradores gerenciam as atividades." }, { status: 403 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Atividade inválida." }, { status: 400 });
  const parsed = activityInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    return NextResponse.json({ activity: await updateActivity(id, parsed.data) });
  } catch (err) {
    return labErrorResponse(err);
  }
}

/** Desativa (não apaga): preserva o histórico dos alunos. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Atividade inválida." }, { status: 400 });
  try {
    await deactivateActivity(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return labErrorResponse(err);
  }
}
