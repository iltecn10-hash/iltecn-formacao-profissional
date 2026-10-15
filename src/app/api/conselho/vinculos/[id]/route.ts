import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { setAssignmentActive } from "@/modules/council/queries";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = z.object({ active: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    if (!(await setAssignmentActive(auth.actor, id, body.data.active)))
      return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return mapError(e); }
}
