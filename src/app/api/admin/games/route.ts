import { NextResponse } from "next/server";
import { z } from "zod";
import { gameErrorResponse, readJson, requireRole } from "@/lib/games-api";
import { createGame, listAdminGames } from "@/modules/games/admin";

export async function GET() {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ games: await listAdminGames() });
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const body = await readJson(request, 512 * 1024);
  if (!body.ok) return body.res;
  const parsed = z.object({ meta: z.unknown(), config: z.unknown().optional() }).safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ game: await createGame(auth.session.userId, parsed.data.meta, parsed.data.config) }, { status: 201 });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
