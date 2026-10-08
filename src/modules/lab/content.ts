import { randomUUID } from "crypto";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_KINDS,
  LAB_SKILLS,
  validateActivityConfig,
} from "@/lib/lab/activities";
import { LAB_TRACK_SLUG, LabError } from "@/modules/lab/queries";

/** Atividade como o ADMINISTRADOR vê: com gabarito completo. Nunca enviar ao aluno. */
export interface AdminActivity {
  id: string;
  code: string;
  mission_id: string;
  sort_order: number;
  kind: string;
  category: string;
  skill: string;
  title: string;
  prompt: string;
  config: unknown;
  xp: number;
  active: boolean;
}

export const activityInputSchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  category: z.enum(ACTIVITY_CATEGORIES),
  skill: z.enum(LAB_SKILLS),
  title: z.string().trim().min(2, "Título muito curto.").max(255),
  prompt: z.string().trim().min(2, "Escreva o enunciado.").max(1000),
  xp: z.number().int().min(0).max(100),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
  config: z.unknown(),
});
export type ActivityInput = z.infer<typeof activityInputSchema>;

const COLUMNS = `id, code, mission_id, sort_order, kind, category, skill, title, prompt, config, xp, active`;

export async function listActivitiesForAdmin(missionId: string): Promise<AdminActivity[]> {
  return query<AdminActivity>(
    `SELECT ${COLUMNS} FROM mission_activities WHERE mission_id = $1 ORDER BY sort_order ASC, code ASC`,
    [missionId]
  );
}

async function assertLabMission(missionId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT m.id FROM missions m
     JOIN modules mo ON mo.id = m.module_id
     JOIN tracks t ON t.id = mo.track_id
     WHERE m.id = $1 AND t.slug = $2`,
    [missionId, LAB_TRACK_SLUG]
  );
  if (!row) throw new LabError("not_found", "Aula do ILTECN LAB não encontrada.");
}

function checkConfig(input: ActivityInput) {
  const error = validateActivityConfig(input.kind, input.config);
  if (error) throw new LabError("invalid", error);
}

export async function createActivity(missionId: string, input: ActivityInput): Promise<AdminActivity> {
  await assertLabMission(missionId);
  checkConfig(input);
  const next = await queryOne<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM mission_activities WHERE mission_id = $1`,
    [missionId]
  );
  const row = await queryOne<AdminActivity>(
    `INSERT INTO mission_activities (code, mission_id, sort_order, kind, category, skill, title, prompt, config, xp, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     RETURNING ${COLUMNS}`,
    [
      `custom-${randomUUID().slice(0, 8)}`,
      missionId,
      input.sortOrder ?? next?.n ?? 1,
      input.kind,
      input.category,
      input.skill,
      input.title,
      input.prompt,
      JSON.stringify(input.config),
      input.xp,
      input.active ?? true,
    ]
  );
  if (!row) throw new LabError("invalid", "Não foi possível criar a atividade.");
  return row;
}

export async function updateActivity(activityId: string, input: ActivityInput): Promise<AdminActivity> {
  const existing = await queryOne<{ mission_id: string }>(
    `SELECT mission_id FROM mission_activities WHERE id = $1`,
    [activityId]
  );
  if (!existing) throw new LabError("not_found", "Atividade não encontrada.");
  await assertLabMission(existing.mission_id);
  checkConfig(input);
  const row = await queryOne<AdminActivity>(
    `UPDATE mission_activities SET kind = $2, category = $3, skill = $4, title = $5, prompt = $6,
            config = $7::jsonb, xp = $8, sort_order = COALESCE($9::int, sort_order), active = $10
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      activityId,
      input.kind,
      input.category,
      input.skill,
      input.title,
      input.prompt,
      JSON.stringify(input.config),
      input.xp,
      input.sortOrder ?? null,
      input.active ?? true,
    ]
  );
  if (!row) throw new LabError("not_found", "Atividade não encontrada.");
  return row;
}

/**
 * "Remover" desativa a atividade em vez de apagar: o histórico de tentativas
 * e o XP dos alunos que já a fizeram nunca se perdem.
 */
export async function deactivateActivity(activityId: string): Promise<void> {
  const existing = await queryOne<{ mission_id: string }>(
    `SELECT mission_id FROM mission_activities WHERE id = $1`,
    [activityId]
  );
  if (!existing) throw new LabError("not_found", "Atividade não encontrada.");
  await assertLabMission(existing.mission_id);
  await query(`UPDATE mission_activities SET active = false WHERE id = $1`, [activityId]);
}
