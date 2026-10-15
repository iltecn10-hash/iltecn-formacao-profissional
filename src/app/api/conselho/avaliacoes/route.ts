import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { getSheet, saveEvaluation } from "@/modules/council/evaluations";

const uuid = z.string().uuid();

export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const p = request.nextUrl.searchParams;
  const assignmentId = uuid.safeParse(p.get("assignmentId"));
  const periodId = uuid.safeParse(p.get("periodId"));
  if (!assignmentId.success || !periodId.success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const sheet = await getSheet(auth.actor, assignmentId.data, periodId.data);
    if (!sheet) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    return NextResponse.json({ sheet });
  } catch (e) { return mapError(e); }
}

const saveSchema = z.object({
  assignmentId: uuid, periodId: uuid, studentId: uuid,
  answers: z.record(z.string().max(60), z.string().max(2000).nullable()),
  expectedVersion: z.number().int().min(0).optional(),
  finalize: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const raw = await request.text();
  if (raw.length > 32_000) return NextResponse.json({ error: "Requisição grande demais." }, { status: 413 });
  let json: unknown = null;
  try { json = JSON.parse(raw); } catch { /* cai na validação */ }
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  try {
    const evaluation = await saveEvaluation(auth.actor, parsed.data);
    return NextResponse.json({ evaluation });
  } catch (e) { return mapError(e); }
}
