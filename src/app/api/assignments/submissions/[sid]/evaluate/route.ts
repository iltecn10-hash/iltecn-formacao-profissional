import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordErrorResponse } from "@/lib/record-route";
import { evaluateSubmission } from "@/modules/assignments/queries";

const schema = z.object({
  status: z.enum(["evaluated", "returned"], { message: "Resultado inválido." }),
  score: z.number().min(0, "Nota inválida.").max(1000).nullable().optional(),
  feedback: z.string().max(3000, "Comentário muito longo.").nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ sid: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { sid } = await params;
  if (!z.string().uuid().safeParse(sid).success) return NextResponse.json({ error: "Entrega inválida." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    await evaluateSubmission({ userId: session.userId, role: session.role }, sid, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
