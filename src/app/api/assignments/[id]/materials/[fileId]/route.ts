import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordErrorResponse } from "@/lib/record-route";
import { removeMaterial } from "@/modules/assignments/queries";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id, fileId } = await params;
  const uuid = z.string().uuid();
  if (!uuid.safeParse(id).success || !uuid.safeParse(fileId).success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  try {
    await removeMaterial({ userId: session.userId, role: session.role }, id, fileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
