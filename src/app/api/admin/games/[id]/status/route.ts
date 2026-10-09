import { NextResponse } from "next/server";
import { z } from "zod";
import { gameErrorResponse, readJson, requireRole, uuidParam } from "@/lib/games-api";
import { setGameStatus } from "@/modules/games/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuidParam.safeParse(id).success) return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = z.object({ status: z.enum(["draft", "published"]) }).safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "Situação inválida." }, { status: 400 });
  try {
    return NextResponse.json({ game: await setGameStatus(id, parsed.data.status) });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
