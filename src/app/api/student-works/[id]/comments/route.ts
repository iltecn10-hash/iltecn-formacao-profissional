import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canAccessWork } from "@/modules/student-works/access";
import {
  addWorkComment,
  getStudentWorkById,
  listWorkComments,
} from "@/modules/student-works/queries";

async function authorizeAccess(workId: string, session: { userId: string; role: string }) {
  const work = await getStudentWorkById(workId);
  if (!work) return { error: "Trabalho não encontrado." as const, status: 404 as const };

  if (!(await canAccessWork(session, work))) {
    return { error: "Sem permissão." as const, status: 403 as const };
  }

  return { work };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const auth = await authorizeAccess(id, session);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const comments = await listWorkComments(id);
  return NextResponse.json({ comments });
}

const createSchema = z.object({
  body: z.string().trim().min(1, "O comentário não pode ficar vazio.").max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const auth = await authorizeAccess(id, session);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const comment = await addWorkComment(id, session.userId, parsed.data.body);
  return NextResponse.json({ comment }, { status: 201 });
}
