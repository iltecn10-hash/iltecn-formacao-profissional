import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { labErrorResponse } from "@/lib/lab-api";
import { activityInputSchema, createActivity, listActivitiesForAdmin } from "@/modules/lab/content";

async function adminOnly() {
  const session = await getSession();
  return session?.role === "admin"
    ? null
    : NextResponse.json({ error: "Apenas administradores gerenciam as atividades." }, { status: 403 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Aula inválida." }, { status: 400 });
  return NextResponse.json({ activities: await listActivitiesForAdmin(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Aula inválida." }, { status: 400 });
  const parsed = activityInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    return NextResponse.json({ activity: await createActivity(id, parsed.data) }, { status: 201 });
  } catch (err) {
    return labErrorResponse(err);
  }
}
