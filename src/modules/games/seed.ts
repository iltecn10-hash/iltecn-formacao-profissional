import { GAME_SEEDS, type GameSeed } from "@/lib/games/content/explorador-digital";
import { validateGameConfig } from "@/lib/games/engine";

export interface SeedClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface GamesSeedSummary {
  gamesCreated: number;
  gamesUpdated: number;
  achievementsCreated: number;
}

/**
 * Semeia os jogos oficiais. Idempotente (jogo por `code`, conquista por `code`).
 * Sem `overwrite`, NUNCA mexe em jogo que já existe (o administrador pode ter editado).
 * Recusa semear um jogo cuja configuração não passa na validação do motor.
 */
export async function seedGames(
  db: SeedClient,
  options: { overwrite?: boolean; seeds?: GameSeed[] } = {}
): Promise<GamesSeedSummary> {
  const summary: GamesSeedSummary = { gamesCreated: 0, gamesUpdated: 0, achievementsCreated: 0 };
  for (const seed of options.seeds ?? GAME_SEEDS) {
    const err = validateGameConfig(seed.config);
    if (err) throw new Error(`Jogo "${seed.code}" inválido: ${err}`);

    const existing = (await db.query(`SELECT id FROM games WHERE code = $1`, [seed.code])).rows[0];
    let gameId = existing?.id as string | undefined;
    const values = [
      seed.title, seed.description, seed.instructions, seed.audience, seed.difficulty, seed.gameType,
      seed.passPercent, seed.maxAttempts, seed.timeLimitSeconds, seed.xpReward, JSON.stringify(seed.config), seed.sortOrder,
    ];
    if (!gameId) {
      const row = (
        await db.query(
          `INSERT INTO games (code, title, description, instructions, audience, difficulty, game_type,
             pass_percent, max_attempts, time_limit_seconds, xp_reward, config, sort_order, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::int,$9::int,$10::int,$11::int,$12::jsonb,$13::int,'published')
           RETURNING id`,
          [seed.code, ...values]
        )
      ).rows[0];
      gameId = row.id as string;
      summary.gamesCreated++;
    } else if (options.overwrite) {
      await db.query(
        `UPDATE games SET title=$2, description=$3, instructions=$4, audience=$5, difficulty=$6, game_type=$7,
           pass_percent=$8::int, max_attempts=$9::int, time_limit_seconds=$10::int, xp_reward=$11::int,
           config=$12::jsonb, sort_order=$13::int, updated_at=now()
         WHERE id = $1::uuid`,
        [gameId, ...values]
      );
      summary.gamesUpdated++;
    }

    for (const a of seed.achievements) {
      const code = `game_${seed.code.replace(/[^a-z0-9]+/g, "_")}_${a.suffix}`.slice(0, 50);
      const found = (await db.query(`SELECT id FROM achievements WHERE code = $1`, [code])).rows[0];
      if (found) continue;
      await db.query(
        `INSERT INTO achievements (code, name, description, icon, criteria_type, criteria_value, criteria_game_id, audience)
         VALUES ($1,$2,$3,$4,'game_completed',1,$5::uuid,$6)`,
        [code, a.name, a.description, a.icon, gameId, a.suffix]
      );
      summary.achievementsCreated++;
    }
  }
  return summary;
}
