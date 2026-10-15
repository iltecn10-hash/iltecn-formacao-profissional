import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { setSubjectActive } from "@/modules/council/queries";

const schema = z.object({ active: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = z.string().uuid().safeParse(id);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !body.success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const subject = await setSubjectActive(auth.actor, id, body.data.active);
    if (!subject) return NextResponse.json({ error: "Disciplina não encontrada." }, { status: 404 });
    return NextResponse.json({ subject });
  } catch (e) { return mapError(e); }
}
