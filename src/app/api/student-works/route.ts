import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import {
  getOrCreateStudentWork,
  listStudentWorksByStudent,
  listStudentWorksForStaff,
} from "@/modules/student-works/queries";

const STAFF_ROLES = ["admin", "teacher", "coordinator"] as const;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.role === "student") {
    const studentId = await getStudentIdByUserId(session.userId);
    if (!studentId) {
      return NextResponse.json({ error: "Perfil de aluno não encontrado." }, { status: 404 });
    }
    const works = await listStudentWorksByStudent(studentId);
    return NextResponse.json({ works });
  }

  if (!STAFF_ROLES.includes(session.role as (typeof STAFF_ROLES)[number])) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const works = await listStudentWorksForStaff({
    studentId: params.get("studentId") ?? undefined,
    missionId: params.get("missionId") ?? undefined,
    status: params.get("status") ?? undefined,
  });
  return NextResponse.json({ works });
}

const createSchema = z.object({
  missionId: z.string().uuid("Missão inválida."),
  workType: z.enum(["DOCUMENT", "SPREADSHEET"]),
  title: z.string().optional(),
  templateKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json(
      { error: "Apenas alunos podem criar trabalhos." },
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

  const studentId = await getStudentIdByUserId(session.userId);
  if (!studentId) {
    return NextResponse.json({ error: "Perfil de aluno não encontrado." }, { status: 404 });
  }

  try {
    const work = await getOrCreateStudentWork(
      studentId,
      parsed.data.missionId,
      parsed.data.workType,
      { title: parsed.data.title, templateKey: parsed.data.templateKey }
    );
    return NextResponse.json({ work }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar o trabalho para esta missão." },
      { status: 400 }
    );
  }
}
