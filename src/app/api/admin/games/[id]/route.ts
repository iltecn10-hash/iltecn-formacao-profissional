import { NextResponse } from "next/server";
import { z } from "zod";
import { gameErrorResponse, readJson, requireRole, uuidParam } from "@/lib/games-api";
import { getAdminGame, updateGame } from "@/modules/games/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuidParam.safeParse(id).success) return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });
  const game = await getAdminGame(id);
  if (!game) return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });
  return NextResponse.json({ game });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuidParam.safeParse(id).success) return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });
  const body = await readJson(request, 512 * 1024);
  if (!body.ok) return body.res;
  const parsed = z.object({ meta: z.unknown(), config: z.unknown().optional() }).safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ game: await updateGame(id, parsed.data.meta, parsed.data.config) });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
