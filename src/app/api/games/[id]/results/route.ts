import { NextRequest, NextResponse } from "next/server";
import { gameErrorResponse, requireRole, uuidParam } from "@/lib/games-api";
import { getGameResults } from "@/modules/games/results";

/** Resultados do jogo — equipe; o escopo (escola/turmas) é aplicado no SQL. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "teacher", "coordinator"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuidParam.safeParse(id).success) return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });
  const classId = request.nextUrl.searchParams.get("classId") ?? undefined;
  if (classId && !uuidParam.safeParse(classId).success) return NextResponse.json({ error: "Turma inválida." }, { status: 400 });
  try {
    const results = await getGameResults({ userId: auth.session.userId, role: auth.session.role }, id, { classId });
    return NextResponse.json({ results });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
