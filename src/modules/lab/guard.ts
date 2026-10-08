import { queryOne } from "@/lib/db";

/**
 * A missão pertence a uma trilha do ILTECN LAB (público infantil)?
 * Essas aulas só podem ser concluídas pelo fluxo próprio (`/api/lab/...`), que
 * exige as atividades feitas — as rotas genéricas de missão devem recusá-las,
 * senão bastaria chamar `/api/missions/complete` para ganhar os pontos.
 */
export async function isKidsMission(missionId: string): Promise<boolean> {
  const row = await queryOne<{ audience: string }>(
    `SELECT t.audience FROM missions m
     JOIN modules mo ON mo.id = m.module_id
     JOIN tracks t ON t.id = mo.track_id
     WHERE m.id = $1`,
    [missionId]
  );
  return row?.audience === "kids";
}
