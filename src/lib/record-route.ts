import { NextResponse } from "next/server";
import { RecordError } from "@/modules/registry/records";

/** Converte o erro de regra (RecordError) em resposta HTTP; erros inesperados viram 500 sem detalhes. */
export function recordErrorResponse(err: unknown) {
  if (err instanceof RecordError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[registro]", err);
  return NextResponse.json({ error: "Não foi possível concluir esta operação." }, { status: 500 });
}

export const DELETE_MESSAGE = {
  deleted: "Cadastro excluído.",
  deactivated: "Este cadastro já tem histórico, então foi desativado (não apagado). Você pode reativá-lo quando quiser.",
} as const;
