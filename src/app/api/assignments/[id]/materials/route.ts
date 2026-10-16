import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordErrorResponse } from "@/lib/record-route";
import { readUploads } from "@/lib/uploads";
import { addMaterials } from "@/modules/assignments/queries";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Atividade inválida." }, { status: 400 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  try {
    const files = await readUploads(form.getAll("files").filter((f): f is File => typeof f !== "string"));
    await addMaterials({ userId: session.userId, role: session.role }, id, files);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
