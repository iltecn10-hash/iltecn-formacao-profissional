import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { recordErrorResponse } from "@/lib/record-route";
import { readUploads } from "@/lib/uploads";
import { createAssignment, listAssignmentsForStaff, listAssignmentsForStudent } from "@/modules/assignments/queries";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const actor = { userId: session.userId, role: session.role };
  const assignments =
    session.role === "student" ? await listAssignmentsForStudent(session.userId) : await listAssignmentsForStaff(actor);
  return NextResponse.json({ assignments });
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

const createSchema = z.object({
  classId: z.string().uuid("Turma inválida."),
  title: z.string().min(3, "Dê um título à atividade.").max(200, "Título muito longo."),
  instructions: z.string().max(5000, "Instruções muito longas.").optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").optional(),
  subjectId: z.string().uuid("Disciplina inválida.").optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json({ error: "Apenas professores e administradores criam atividades." }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  const parsed = createSchema.safeParse({
    classId: text(form.get("classId")),
    title: text(form.get("title")),
    instructions: text(form.get("instructions")) || undefined,
    dueDate: text(form.get("dueDate")) || undefined,
    subjectId: text(form.get("subjectId")) || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    const files = await readUploads(form.getAll("files").filter((f): f is File => typeof f !== "string"));
    const created = await createAssignment({ userId: session.userId, role: session.role }, parsed.data, files);
    return NextResponse.json({ assignment: created }, { status: 201 });
  } catch (err) {
    return recordErrorResponse(err);
  }
}
