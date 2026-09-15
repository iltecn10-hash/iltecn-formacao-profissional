import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listMissionTasksWithVideo } from "@/modules/missions/queries";

/**
 * Lista as etapas de uma missão com o vídeo associado a cada uma (Fase
 * 10.1). Sem restrição por papel além de estar autenticado — a descrição da
 * etapa e os metadados do vídeo não são dados sensíveis, e tanto o aluno
 * (para assistir) quanto a equipe (para o formulário de gerenciar vídeos,
 * na 10.3) precisam poder ler isto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const tasks = await listMissionTasksWithVideo(id);
  return NextResponse.json({ tasks });
}
