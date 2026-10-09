import { NextResponse } from "next/server";
import { z } from "zod";
import { gameErrorResponse, readJson, requireStudent, uuidParam } from "@/lib/games-api";
import { submitChallenge } from "@/modules/games/queries";

const bodySchema = z.object({ challengeId: z.string().min(1).max(60), submission: z.unknown() });

/** Recebe SÓ a resposta; nota, tentativas e liberação de fase são decididas no servidor. */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireStudent();
  if ("error" in auth) return auth.error;
  const { attemptId } = await params;
  if (!uuidParam.safeParse(attemptId).success) return NextResponse.json({ error: "Partida inválida." }, { status: 400 });
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = bodySchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ result: await submitChallenge(auth.studentId, attemptId, parsed.data.challengeId, parsed.data.submission) });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
