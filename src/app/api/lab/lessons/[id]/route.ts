import { NextResponse } from "next/server";
import { z } from "zod";
import { labErrorResponse, requireStudent } from "@/lib/lab-api";
import { getLabLesson } from "@/modules/lab/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudent();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Aula inválida." }, { status: 400 });
  }
  try {
    return NextResponse.json({ lesson: await getLabLesson(auth.studentId, id) });
  } catch (err) {
    return labErrorResponse(err);
  }
}
