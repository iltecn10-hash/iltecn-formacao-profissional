import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import {
  getStudentWorkById,
  saveStudentWorkContent,
  StudentWorkNotEditableError,
} from "@/modules/student-works/queries";

const STAFF_ROLES = ["admin", "teacher", "coordinator"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const work = await getStudentWorkById(id);
  if (!work) {
    return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  }

  if (session.role === "student") {
    const ownStudentId = await getStudentIdByUserId(session.userId);
    if (ownStudentId !== work.student_id) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  } else if (!STAFF_ROLES.includes(session.role as (typeof STAFF_ROLES)[number])) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  return NextResponse.json({ work });
}

const saveSchema = z.object({
  content: z.record(z.string(), z.unknown()),
  title: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json(
      { error: "Apenas o aluno dono do trabalho pode editá-lo." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
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
    const work = await saveStudentWorkContent(id, studentId, parsed.data);
    return NextResponse.json({ work });
  } catch (err) {
    if (err instanceof StudentWorkNotEditableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Não foi possível salvar o trabalho." },
      { status: 400 }
    );
  }
}
