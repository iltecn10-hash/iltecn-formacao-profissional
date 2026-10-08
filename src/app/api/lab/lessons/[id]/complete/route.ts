import { NextResponse } from "next/server";
import { z } from "zod";
import { labErrorResponse, requireStudent } from "@/lib/lab-api";
import { completeLabLesson } from "@/modules/lab/queries";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudent();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Aula inválida." }, { status: 400 });
  }
  try {
    return NextResponse.json({ result: await completeLabLesson(auth.studentId, id) });
  } catch (err) {
    return labErrorResponse(err);
  }
}
