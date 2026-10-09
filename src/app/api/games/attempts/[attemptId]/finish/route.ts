import { NextResponse } from "next/server";
import { gameErrorResponse, requireStudent, uuidParam } from "@/lib/games-api";
import { finishAttempt } from "@/modules/games/queries";

export async function POST(_req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireStudent();
  if ("error" in auth) return auth.error;
  const { attemptId } = await params;
  if (!uuidParam.safeParse(attemptId).success) return NextResponse.json({ error: "Partida inválida." }, { status: 400 });
  try {
    return NextResponse.json({ result: await finishAttempt(auth.studentId, attemptId) });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
