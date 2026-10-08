import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { labErrorResponse, requireStudent } from "@/lib/lab-api";
import { submitActivity } from "@/modules/lab/queries";

// Corpo pequeno: a maior resposta (simulador de arquivos) tem poucos KB.
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudent();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Atividade inválida." }, { status: 400 });
  }

  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Resposta grande demais." }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const parsed = z.object({ submission: z.unknown() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    return NextResponse.json({ result: await submitActivity(auth.studentId, id, parsed.data.submission) });
  } catch (err) {
    return labErrorResponse(err);
  }
}
