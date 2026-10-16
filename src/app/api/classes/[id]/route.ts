import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { DELETE_MESSAGE, recordErrorResponse } from "@/lib/record-route";
import { deleteClass, setClassActive, updateClass } from "@/modules/registry/records";

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const idSchema = z.string().uuid();

const editSchema = z.object({
  name: z.string().trim().min(1, "Nome muito curto."),
  shift: z.preprocess(empty, z.enum(["manha", "tarde", "noite", "integral"]).nullable().optional()),
  schoolYear: z.number().int().min(2020).max(2100),
  teacherId: z.preprocess(empty, z.string().uuid().nullable().optional()),
});
const activeSchema = z.object({ active: z.boolean() });

async function actorOr403() {
  const session = await getSession();
  if (!session || session.role === "student") return null;
  return { userId: session.userId, role: session.role };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOr403();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 });
  const body = await request.json().catch(() => null);
  try {
    const onlyActive = activeSchema.safeParse(body);
    if (onlyActive.success) {
      await setClassActive(actor, id, onlyActive.data.active);
      return NextResponse.json({ ok: true });
    }
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }
    await updateClass(actor, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return recordErrorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOr403();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 });
  try {
    const result = await deleteClass(actor, id);
    return NextResponse.json({ result, message: DELETE_MESSAGE[result] });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
