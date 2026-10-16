import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordErrorResponse } from "@/lib/record-route";
import { readUploads } from "@/lib/uploads";
import { submitAssignment } from "@/modules/assignments/queries";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json({ error: "Apenas alunos entregam atividades." }, { status: 403 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Atividade inválida." }, { status: 400 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  const rawComment = form.get("comment");
  const comment = typeof rawComment === "string" && rawComment.trim() ? rawComment.trim().slice(0, 2000) : null;
  try {
    const files = await readUploads(form.getAll("files").filter((f): f is File => typeof f !== "string"));
    const result = await submitAssignment({ userId: session.userId, role: session.role }, id, comment, files);
    return NextResponse.json({ submission: result }, { status: 201 });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
