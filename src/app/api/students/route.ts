import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listStudents, createStudent } from "@/modules/students/queries";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const students = await listStudents();
  return NextResponse.json({ students });
}

const createSchema = z.object({
  name: z.string().min(2, "Nome muito curto."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres."),
  schoolId: z.string().uuid("Escola inválida."),
  birthDate: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json(
      { error: "Você não tem permissão para cadastrar alunos." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  try {
    const student = await createStudent(parsed.data);
    return NextResponse.json({ student }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "Já existe um usuário com este e-mail."
        : "Não foi possível concluir esta operação. Verifique os dados e tente novamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
