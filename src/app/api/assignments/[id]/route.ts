import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { DELETE_MESSAGE, recordErrorResponse } from "@/lib/record-route";
import { deleteAssignment, setAssignmentClosed, updateAssignment } from "@/modules/assignments/queries";

const idSchema = z.string().uuid();
const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const editSchema = z.object({
  title: z.string().trim().min(3, "Dê um título à atividade.").max(200),
  instructions: z.preprocess(empty, z.string().max(5000).nullable().optional()),
  subjectId: z.preprocess(empty, z.string().uuid("Disciplina inválida.").nullable().optional()),
  dueDate: z.preprocess(empty, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable().optional()),
});
// "active" = atividade aberta (reativar/desativar do RecordActions).
const activeSchema = z.object({ active: z.boolean() });

async function actorOr403() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) return null;
  return { userId: session.userId, role: session.role };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOr403();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Atividade inválida." }, { status: 400 });
  const body = await request.json().catch(() => null);
  try {
    const onlyActive = activeSchema.safeParse(body);
    if (onlyActive.success) {
      await setAssignmentClosed(actor, id, !onlyActive.data.active);
      return NextResponse.json({ ok: true });
    }
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }
    await updateAssignment(actor, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return recordErrorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOr403();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Atividade inválida." }, { status: 400 });
  try {
    const result = await deleteAssignment(actor, id);
    return NextResponse.json({ result, message: DELETE_MESSAGE[result] });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
