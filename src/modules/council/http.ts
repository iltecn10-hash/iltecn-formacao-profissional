import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { ScopeActor } from "@/modules/schools/scope";
import { CouncilForbiddenError, CouncilInvalidError } from "./queries";
import { EvaluationConflictError, EvaluationLockedError } from "./evaluations";

/** Sessão da equipe (admin/professor/coordenador) ou a resposta de erro pronta. */
export async function requireStaff(): Promise<{ actor: ScopeActor } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (session.role === "student")
    return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  return { actor: { userId: session.userId, role: session.role } };
}

export function mapError(e: unknown): NextResponse {
  if (e instanceof CouncilForbiddenError)
    return NextResponse.json({ error: "Você não tem permissão para esta ação." }, { status: 403 });
  if (e instanceof CouncilInvalidError)
    return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof EvaluationLockedError)
    return NextResponse.json({ error: "Esta avaliação já foi finalizada. Peça à coordenação para reabri-la." }, { status: 409 });
  if (e instanceof EvaluationConflictError)
    return NextResponse.json({ error: "Esta avaliação foi alterada em outro lugar. Recarregue a página." }, { status: 409 });
  console.error("[conselho]", e instanceof Error ? e.message : "erro desconhecido");
  return NextResponse.json({ error: "Erro interno." }, { status: 500 });
}

export const NO_SCHOOL = () =>
  NextResponse.json({ error: "Escola não informada ou sem permissão." }, { status: 403 });
