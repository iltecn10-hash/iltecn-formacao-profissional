import { query, queryOne } from "@/lib/db";
import { validateGameConfig } from "@/lib/games/engine";
import { gameMetaSchema, type GameMetaInput } from "@/lib/games/types";

export class GameAdminError extends Error {
  constructor(
    public code: "invalid" | "not_found" | "conflict",
    message: string
  ) {
    super(message);
  }
}

export interface AdminGame {
  id: string;
  code: string;
  title: string;
  description: string;
  instructions: string;
  audience: string;
  difficulty: string;
  gameType: string;
  trackId: string | null;
  moduleId: string | null;
  missionId: string | null;
  requiresMissionId: string | null;
  requiresGameId: string | null;
  completesMission: boolean;
  passPercent: number;
  maxAttempts: number | null;
  timeLimitSeconds: number | null;
  xpReward: number;
  sortOrder: number;
  status: string;
  config: unknown;
  attemptsCount: number;
}

type Row = Record<string, unknown>;
function toAdminGame(r: Row): AdminGame {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(r.id), code: String(r.code), title: String(r.title),
    description: String(r.description ?? ""), instructions: String(r.instructions ?? ""),
    audience: String(r.audience), difficulty: String(r.difficulty), gameType: String(r.game_type),
    trackId: (r.track_id as string | null) ?? null, moduleId: (r.module_id as string | null) ?? null,
    missionId: (r.mission_id as string | null) ?? null,
    requiresMissionId: (r.requires_mission_id as string | null) ?? null,
    requiresGameId: (r.requires_game_id as string | null) ?? null,
    completesMission: Boolean(r.completes_mission), passPercent: Number(r.pass_percent),
    maxAttempts: n(r.max_attempts), timeLimitSeconds: n(r.time_limit_seconds), xpReward: Number(r.xp_reward),
    sortOrder: Number(r.sort_order), status: String(r.status), config: r.config,
    attemptsCount: Number(r.attempts_count ?? 0),
  };
}

export async function listAdminGames(): Promise<AdminGame[]> {
  const rows = await query<Row>(
    `SELECT g.*, COALESCE(c.n, 0) AS attempts_count
     FROM games g
     LEFT JOIN (SELECT game_id, COUNT(*)::int AS n FROM game_attempts GROUP BY game_id) c ON c.game_id = g.id
     ORDER BY g.sort_order, g.title`
  );
  return rows.map(toAdminGame);
}

export async function getAdminGame(id: string): Promise<AdminGame | null> {
  const row = await queryOne<Row>(
    `SELECT g.*, COALESCE(c.n, 0) AS attempts_count
     FROM games g
     LEFT JOIN (SELECT game_id, COUNT(*)::int AS n FROM game_attempts GROUP BY game_id) c ON c.game_id = g.id
     WHERE g.id = $1::uuid`,
    [id]
  );
  return row ? toAdminGame(row) : null;
}

/** Confere se os vínculos (trilha/módulo/missão/pré-requisitos) existem e são coerentes. */
async function checkLinks(meta: GameMetaInput, selfId: string | null): Promise<void> {
  const checks: [string | null | undefined, string, string][] = [
    [meta.trackId, "tracks", "Trilha"],
    [meta.moduleId, "modules", "Módulo"],
    [meta.missionId, "missions", "Missão"],
    [meta.requiresMissionId, "missions", "Missão pré-requisito"],
    [meta.requiresGameId, "games", "Jogo pré-requisito"],
  ];
  for (const [id, table, label] of checks) {
    if (!id) continue;
    const found = await queryOne(`SELECT id FROM ${table} WHERE id = $1::uuid`, [id]);
    if (!found) throw new GameAdminError("invalid", `${label} não encontrada.`);
  }
  if (meta.completesMission && !meta.missionId) {
    throw new GameAdminError("invalid", "Para concluir a missão, escolha a missão vinculada.");
  }
  if (selfId && meta.requiresGameId === selfId) {
    throw new GameAdminError("invalid", "Um jogo não pode ser pré-requisito de si mesmo.");
  }
}

export function parseMeta(input: unknown): GameMetaInput {
  const parsed = gameMetaSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new GameAdminError("invalid", `${issue.path.join(".") || "Dados"}: ${issue.message}`);
  }
  return parsed.data;
}

function params(meta: GameMetaInput, config: unknown): unknown[] {
  return [
    meta.code, meta.title, meta.description, meta.instructions, meta.audience, meta.difficulty, meta.gameType,
    meta.trackId ?? null, meta.moduleId ?? null, meta.missionId ?? null, meta.requiresMissionId ?? null,
    meta.requiresGameId ?? null, meta.completesMission, meta.passPercent, meta.maxAttempts ?? null,
    meta.timeLimitSeconds ?? null, meta.xpReward, JSON.stringify(config), meta.sortOrder,
  ];
}

export async function createGame(userId: string, input: unknown, config: unknown): Promise<AdminGame> {
  const meta = parseMeta(input);
  await checkLinks(meta, null);
  const dup = await queryOne(`SELECT id FROM games WHERE code = $1`, [meta.code]);
  if (dup) throw new GameAdminError("conflict", "Já existe um jogo com este código.");
  // Rascunho aceita configuração incompleta; só a validação de formato mínimo (objeto) vale aqui.
  const cfg = config && typeof config === "object" ? config : { phases: [] };
  const row = await queryOne<Row>(
    `INSERT INTO games (code, title, description, instructions, audience, difficulty, game_type, track_id, module_id,
       mission_id, requires_mission_id, requires_game_id, completes_mission, pass_percent, max_attempts,
       time_limit_seconds, xp_reward, config, sort_order, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::uuid,$9::uuid,$10::uuid,$11::uuid,$12::uuid,$13,$14::int,$15::int,$16::int,$17::int,$18::jsonb,$19::int,$20::uuid)
     RETURNING *`,
    [...params(meta, cfg), userId]
  );
  return toAdminGame(row!);
}

export async function updateGame(id: string, input: unknown, config: unknown): Promise<AdminGame> {
  const meta = parseMeta(input);
  const current = await getAdminGame(id);
  if (!current) throw new GameAdminError("not_found", "Jogo não encontrado.");
  await checkLinks(meta, id);
  const dup = await queryOne(`SELECT id FROM games WHERE code = $1 AND id <> $2::uuid`, [meta.code, id]);
  if (dup) throw new GameAdminError("conflict", "Já existe um jogo com este código.");
  const cfg = config && typeof config === "object" ? config : current.config;
  if (current.status === "published") {
    const err = validateGameConfig(cfg);
    if (err) throw new GameAdminError("invalid", `${err} Despublique antes de salvar um jogo incompleto.`);
  }
  const row = await queryOne<Row>(
    `UPDATE games SET code=$1, title=$2, description=$3, instructions=$4, audience=$5, difficulty=$6, game_type=$7,
       track_id=$8::uuid, module_id=$9::uuid, mission_id=$10::uuid, requires_mission_id=$11::uuid,
       requires_game_id=$12::uuid, completes_mission=$13, pass_percent=$14::int, max_attempts=$15::int,
       time_limit_seconds=$16::int, xp_reward=$17::int, config=$18::jsonb, sort_order=$19::int, updated_at=now()
     WHERE id = $20::uuid RETURNING *`,
    [...params(meta, cfg), id]
  );
  return toAdminGame(row!);
}

/** Publicar exige configuração válida; despublicar preserva todo o histórico. */
export async function setGameStatus(id: string, status: "draft" | "published"): Promise<AdminGame> {
  const current = await getAdminGame(id);
  if (!current) throw new GameAdminError("not_found", "Jogo não encontrado.");
  if (status === "published") {
    const err = validateGameConfig(current.config);
    if (err) throw new GameAdminError("invalid", `Não é possível publicar: ${err}`);
  }
  const row = await queryOne<Row>(`UPDATE games SET status = $2, updated_at = now() WHERE id = $1::uuid RETURNING *`, [id, status]);
  return toAdminGame(row!);
}

/** Listas para os seletores do formulário (somente administrador). */
export async function loadAdminOptions() {
  const [tracks, modules, missions, games] = await Promise.all([
    query<{ id: string; label: string }>(`SELECT id, name AS label FROM tracks ORDER BY sort_order, name`),
    query<{ id: string; label: string }>(
      `SELECT mo.id, t.name || ' › ' || mo.name AS label FROM modules mo JOIN tracks t ON t.id = mo.track_id ORDER BY t.sort_order, mo.sort_order`
    ),
    query<{ id: string; label: string }>(
      `SELECT mi.id, mo.name || ' › ' || mi.title AS label FROM missions mi JOIN modules mo ON mo.id = mi.module_id ORDER BY mo.sort_order, mi.sort_order`
    ),
    query<{ id: string; label: string }>(`SELECT id, title AS label FROM games ORDER BY sort_order, title`),
  ]);
  return { tracks, modules, missions, games };
}
