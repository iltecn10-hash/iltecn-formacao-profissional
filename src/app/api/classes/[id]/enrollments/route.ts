import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordErrorResponse } from "@/lib/record-route";
import { enrollInClass, getClassRoster, unenrollFromClass } from "@/modules/classes/enrollments";

const uuid = z.string().uuid();

async function actorOr403() {
  const session = await getSession();
  if (!session || session.role === "student") return null;
  return { userId: session.userId, role: session.role };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOr403();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ error: "Turma inválida." }, { status: 400 });
  try {
    return NextResponse.json(await getClassRoster(actor, id));
  } catch (err) {
    return recordErrorResponse(err);
  }
}

const bodySchema = z.object({ studentId: uuid });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOr403();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ error: "Turma inválida." }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Aluno inválido." }, { status: 400 });
  try {
    await enrollInClass(actor, id, parsed.data.studentId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return recordErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOr403();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  const studentId = request.nextUrl.searchParams.get("studentId") ?? "";
  if (!uuid.safeParse(id).success || !uuid.safeParse(studentId).success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  try {
    await unenrollFromClass(actor, id, studentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
