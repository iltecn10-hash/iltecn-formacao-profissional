import { NextResponse } from "next/server";
import { gameErrorResponse, requireStudent, uuidParam } from "@/lib/games-api";
import { startAttempt } from "@/modules/games/queries";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudent();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuidParam.safeParse(id).success) return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });
  try {
    return NextResponse.json({ attempt: await startAttempt(auth.studentId, id) });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
