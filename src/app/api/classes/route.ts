import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listClasses, createClass, teacherBelongsToSchool } from "@/modules/classes/queries";
import { canActorUseSchool } from "@/modules/schools/scope";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.role === "student") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const classes = await listClasses({ userId: session.userId, role: session.role });
  return NextResponse.json({ classes });
}

const createSchema = z.object({
  name: z.string().min(1, "Nome muito curto."),
  schoolId: z.string().uuid("Escola inválida."),
  teacherId: z.string().uuid().optional(),
  shift: z.enum(["manha", "tarde", "noite", "integral"]).optional(),
  schoolYear: z.number().int().min(2020).max(2100),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json(
      { error: "Você não tem permissão para criar turmas." },
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

  // A escola vem do corpo da requisição: confere no servidor se este usuário pode usá-la
  // (professor só a própria) e se o professor indicado pertence a ela.
  const actor = { userId: session.userId, role: session.role };
  if (!(await canActorUseSchool(actor, parsed.data.schoolId))) {
    return NextResponse.json(
      { error: "Você não tem permissão para criar turmas nesta escola." },
      { status: 403 }
    );
  }
  if (
    parsed.data.teacherId &&
    !(await teacherBelongsToSchool(parsed.data.teacherId, parsed.data.schoolId))
  ) {
    return NextResponse.json(
      { error: "O professor informado não pertence a esta escola." },
      { status: 400 }
    );
  }

  const schoolClass = await createClass(parsed.data);
  return NextResponse.json({ class: schoolClass }, { status: 201 });
}
