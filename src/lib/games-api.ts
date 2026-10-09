import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { requireStudent } from "@/lib/lab-api";
import { GameError } from "@/modules/games/queries";
import { GameAdminError } from "@/modules/games/admin";
import { ResultsError } from "@/modules/games/results";
import type { SessionPayload } from "@/types";

export { requireStudent };

const STATUS = { not_found: 404, forbidden: 403, locked: 423, limit: 429, invalid: 400, conflict: 409, incomplete: 409 } as const;

/** Mensagem de negócio vira resposta clara; o resto, erro genérico sem vazar detalhes. */
export function gameErrorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
  }
  if (err instanceof GameAdminError) {
    const status = err.code === "not_found" ? 404 : err.code === "conflict" ? 409 : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  if (err instanceof ResultsError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "forbidden" ? 403 : 404 });
  }
  return NextResponse.json({ error: "Não foi possível concluir esta operação. Tente novamente." }, { status: 400 });
}

export async function requireRole(roles: SessionPayload["role"][]): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }
  return { session };
}

export const uuidParam = z.string().uuid();

/** Lê um JSON pequeno do corpo, com limite de tamanho. */
export async function readJson(request: Request, maxBytes = 32 * 1024): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const raw = await request.text().catch(() => "");
  if (raw.length > maxBytes) return { ok: false, res: NextResponse.json({ error: "Dados grandes demais." }, { status: 413 }) };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Dados inválidos." }, { status: 400 }) };
  }
}
