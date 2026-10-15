import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { updateCriterion } from "@/modules/council/queries";

const schema = z.object({
  label: z.string().min(3).max(200).optional(),
  active: z.boolean().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const criterion = await updateCriterion(auth.actor, id, body.data);
    if (!criterion) return NextResponse.json({ error: "Critério não encontrado." }, { status: 404 });
    return NextResponse.json({ criterion });
  } catch (e) { return mapError(e); }
}
