import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { updatePeriod } from "@/modules/council/queries";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  startsOn: date.optional(),
  endsOn: date.optional(),
  status: z.enum(["open", "closed"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const period = await updatePeriod(auth.actor, id, body.data);
    if (!period) return NextResponse.json({ error: "Período não encontrado." }, { status: 404 });
    return NextResponse.json({ period });
  } catch (e) { return mapError(e); }
}
