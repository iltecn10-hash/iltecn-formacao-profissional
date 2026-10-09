import { pool, query } from "@/lib/db";
import {
  applyGrade,
  buildGuidance,
  evaluateFinish,
  findChallenge,
  gradeChallenge,
  isPhaseOpen,
  parseGameConfig,
  readState,
  starsFor,
  summarize,
  toPublicPhases,
  type EndReason,
  type GameConfig,
} from "@/lib/games/engine";
import type {
  ChallengeProgress,
  FinishedResult,
  GameCard,
  GameCardState,
  GameDetail,
  OpenAttemptView,
} from "@/lib/games/types";
import { completeMissionAttempt } from "@/modules/missions/queries";

/** Qualquer coisa com `query()` — o pool, um client de transação ou o pg-mem. */
export interface Db {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export type GameErrorCode = "not_found" | "forbidden" | "locked" | "limit" | "invalid" | "conflict" | "incomplete";

/** Erro de regra de negócio com mensagem pronta para mostrar ao aluno. */
export class GameError extends Error {
  constructor(
    public code: GameErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GameError";
  }
}

const iso = (v: unknown): string | null => (v ? new Date(v as string | number | Date).toISOString() : null);

async function withTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client as unknown as Db);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface GameRow {
  id: string;
  code: string;
  title: string;
  description: string;
  instructions: string;
  audience: string;
  difficulty: string;
  game_type: string;
  mission_id: string | null;
  requires_mission_id: string | null;
  requires_game_id: string | null;
  completes_mission: boolean;
  pass_percent: number;
  max_attempts: number | null;
  time_limit_seconds: number | null;
  xp_reward: number;
  config: unknown;
  status: string;
}

async function loadGame(db: Db, gameId: string): Promise<GameRow | null> {
  const r = await db.query(`SELECT * FROM games WHERE id = $1::uuid`, [gameId]);
  return (r.rows[0] as unknown as GameRow) ?? null;
}

interface StudentCtx {
  id: string;
  audience: "professional" | "kids";
  points: number;
}

async function loadStudent(db: Db, studentId: string): Promise<StudentCtx> {
  const r = (await db.query(`SELECT id, audience, points FROM students WHERE id = $1::uuid`, [studentId])).rows[0];
  if (!r) throw new GameError("not_found", "Aluno não encontrado.");
  return { id: String(r.id), audience: r.audience === "kids" ? "kids" : "professional", points: Number(r.points) };
}

/** O jogo é visível para este público? (jogo publicado e do público do aluno ou de todos) */
export function visibleTo(game: Pick<GameRow, "status" | "audience">, audience: string): boolean {
  return game.status === "published" && (game.audience === "all" || game.audience === audience);
}

/** Motivo do bloqueio (regras de liberação do jogo) ou `null` se está liberado. */
async function lockReason(db: Db, game: GameRow, studentId: string): Promise<string | null> {
  if (game.requires_mission_id) {
    const m = (
      await db.query(
        `SELECT ma.status, mi.title FROM missions mi
         LEFT JOIN mission_attempts ma ON ma.mission_id = mi.id AND ma.student_id = $2::uuid
         WHERE mi.id = $1::uuid`,
        [game.requires_mission_id, studentId]
      )
    ).rows[0];
    if (m && m.status !== "concluida") return `Conclua antes a missão "${m.title}".`;
  }
  if (game.requires_game_id) {
    const g = (
      await db.query(
        `SELECT g.title, p.completed FROM games g
         LEFT JOIN student_game_progress p ON p.game_id = g.id AND p.student_id = $2::uuid
         WHERE g.id = $1::uuid`,
        [game.requires_game_id, studentId]
      )
    ).rows[0];
    if (g && !g.completed) return `Conclua antes o jogo "${g.title}".`;
  }
  return null;
}

// ---- Lista e detalhe --------------------------------------------------------------------------

export async function listGamesForStudent(studentId: string, db: Db = defaultDb): Promise<GameCard[]> {
  const student = await loadStudent(db, studentId);
  const games = (
    await db.query(
      `SELECT g.*, mi.title AS mission_title FROM games g
       LEFT JOIN missions mi ON mi.id = g.mission_id
       WHERE g.status = 'published' AND (g.audience = 'all' OR g.audience = $1)
       ORDER BY g.sort_order, g.title`,
      [student.audience]
    )
  ).rows;
  const prog = new Map(
    (
      await db.query(
        `SELECT game_id, attempts, best_percent, completed FROM student_game_progress WHERE student_id = $1::uuid`,
        [studentId]
      )
    ).rows.map((r) => [String(r.game_id), r])
  );
  const open = new Set(
    (
      await db.query(`SELECT game_id FROM game_attempts WHERE student_id = $1::uuid AND status = 'in_progress'`, [
        studentId,
      ])
    ).rows.map((r) => String(r.game_id))
  );
  const cards: GameCard[] = [];
  for (const row of games) {
    const g = row as unknown as GameRow & { mission_title: string | null };
    const p = prog.get(g.id);
    const attempts = Number(p?.attempts ?? 0);
    const completed = Boolean(p?.completed);
    const reason = await lockReason(db, g, studentId);
    const limitHit = g.max_attempts !== null && attempts >= Number(g.max_attempts) && !open.has(g.id);
    let state: GameCardState = "available";
    if (reason) state = "locked";
    else if (open.has(g.id)) state = "in_progress";
    else if (limitHit) state = "limit";
    else if (completed) state = "completed";
    cards.push({
      id: g.id,
      code: g.code,
      title: g.title,
      description: g.description,
      difficulty: g.difficulty,
      gameType: g.game_type,
      xpReward: Number(g.xp_reward),
      passPercent: Number(g.pass_percent),
      maxAttempts: g.max_attempts === null ? null : Number(g.max_attempts),
      phases: parseGameConfig(g.config)?.phases.length ?? 0,
      missionTitle: g.mission_title,
      state,
      lockReason: reason,
      attempts,
      bestPercent: Number(p?.best_percent ?? 0),
      completed,
    });
  }
  return cards;
}

function buildOpenView(attempt: Record<string, unknown>, config: GameConfig): OpenAttemptView {
  const attemptId = String(attempt.id);
  const state = readState(attempt.state);
  const summary = summarize(config, state);
  const phases = toPublicPhases(config, attemptId).map((p, i) => {
    const open = isPhaseOpen(summary, i);
    return { ...p, locked: !open, challengeCount: p.challenges.length, challenges: open ? p.challenges : [] };
  });
  const progress: Record<string, ChallengeProgress> = {};
  for (const phase of config.phases) {
    for (const c of phase.challenges) {
      const st = state.challenges[c.id];
      if (!st) continue;
      progress[c.id] = {
        tries: st.tries,
        resolved: st.resolved,
        correct: st.correct,
        points: st.points,
        explain: st.resolved ? (c.explain ?? null) : null,
      };
    }
  }
  return {
    id: attemptId,
    version: Number(attempt.version),
    startedAt: iso(attempt.started_at) as string,
    expiresAt: iso(attempt.expires_at),
    phases,
    progress,
    summary,
  };
}

function isExpired(attempt: Record<string, unknown>): boolean {
  return Boolean(attempt.expires_at) && new Date(attempt.expires_at as string).getTime() <= Date.now();
}

export async function getGameDetail(studentId: string, gameId: string): Promise<GameDetail> {
  return withTx(async (db) => {
    const student = await loadStudent(db, studentId);
    const game = await loadGame(db, gameId);
    if (!game || !visibleTo(game, student.audience)) throw new GameError("not_found", "Jogo não encontrado.");
    const config = parseGameConfig(game.config);
    if (!config) throw new GameError("invalid", "Este jogo está com a configuração incompleta.");

    // Partida vencida pelo relógio é encerrada aqui (o tempo nunca "congela").
    let openRow: Record<string, unknown> | undefined = (
      await db.query(`SELECT * FROM game_attempts WHERE game_id = $1::uuid AND student_id = $2::uuid AND status = 'in_progress'`, [
        gameId,
        studentId,
      ])
    ).rows[0];
    if (openRow && isExpired(openRow)) {
      await finalize(db, game, config, openRow, student, "time");
      openRow = undefined;
    }

    const cards = await listGamesForStudent(studentId, db);
    const card = cards.find((c) => c.id === gameId);
    if (!card) throw new GameError("not_found", "Jogo não encontrado.");

    const lastRow = (
      await db.query(
        `SELECT result FROM game_attempts WHERE game_id = $1::uuid AND student_id = $2::uuid AND status <> 'in_progress'
         ORDER BY finished_at DESC, started_at DESC LIMIT 1`,
        [gameId, studentId]
      )
    ).rows[0];
    return {
      ...card,
      instructions: game.instructions,
      timeLimitSeconds: game.time_limit_seconds === null ? null : Number(game.time_limit_seconds),
      attemptsLeft: card.maxAttempts === null ? null : Math.max(0, card.maxAttempts - card.attempts),
      kids: student.audience === "kids",
      open: openRow ? buildOpenView(openRow, config) : null,
      last: (lastRow?.result as FinishedResult | undefined) ?? null,
    };
  });
}

// ---- Iniciar partida ----------------------------------------------------------------------------------

async function startOnce(studentId: string, gameId: string): Promise<OpenAttemptView> {
  return withTx(async (db) => {
    const student = await loadStudent(db, studentId);
    const game = await loadGame(db, gameId);
    if (!game || !visibleTo(game, student.audience)) throw new GameError("not_found", "Jogo não encontrado.");
    const config = parseGameConfig(game.config);
    if (!config) throw new GameError("invalid", "Este jogo está com a configuração incompleta.");
    const reason = await lockReason(db, game, studentId);
    if (reason) throw new GameError("locked", reason);

    let open: Record<string, unknown> | undefined = (
      await db.query(`SELECT * FROM game_attempts WHERE game_id = $1::uuid AND student_id = $2::uuid AND status = 'in_progress'`, [
        gameId,
        studentId,
      ])
    ).rows[0];
    if (open && isExpired(open)) {
      await finalize(db, game, config, open, student, "time");
      open = undefined;
    }
    if (open) return buildOpenView(open, config);

    if (game.max_attempts !== null) {
      const used = (
        await db.query(`SELECT COUNT(*)::int AS n FROM game_attempts WHERE game_id = $1::uuid AND student_id = $2::uuid`, [
          gameId,
          studentId,
        ])
      ).rows[0];
      if (Number(used?.n) >= Number(game.max_attempts)) {
        throw new GameError("limit", `Você já usou as ${game.max_attempts} tentativas deste jogo. Fale com o seu professor.`);
      }
    }
    const expires = game.time_limit_seconds ? new Date(Date.now() + Number(game.time_limit_seconds) * 1000).toISOString() : null;
    const created = (
      await db.query(
        `INSERT INTO game_attempts (game_id, student_id, state, expires_at)
         VALUES ($1::uuid, $2::uuid, '{"challenges":{}}'::jsonb, $3)
         RETURNING *`,
        [gameId, studentId, expires]
      )
    ).rows[0];
    return buildOpenView(created, config);
  });
}

/** Inicia (ou retoma) a partida. Dois cliques simultâneos resultam na MESMA partida. */
export async function startAttempt(studentId: string, gameId: string): Promise<OpenAttemptView> {
  try {
    return await startOnce(studentId, gameId);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return startOnce(studentId, gameId);
    throw err;
  }
}

// ---- Responder um desafio ---------------------------------------------------------------------------------

export interface SubmitChallengeResult {
  correct: boolean;
  percent: number;
  feedback: string;
  resolved: boolean;
  triesLeft: number;
  points: number;
  explain: string | null;
  /** O tempo acabou: a partida foi encerrada e este é o resultado. */
  expired: FinishedResult | null;
  open: OpenAttemptView | null;
}

export async function submitChallenge(
  studentId: string,
  attemptId: string,
  challengeId: string,
  submission: unknown
): Promise<SubmitChallengeResult> {
  const out = await withTx(async (db) => {
    const student = await loadStudent(db, studentId);
    const attempt = (
      await db.query(`SELECT * FROM game_attempts WHERE id = $1::uuid AND student_id = $2::uuid`, [attemptId, studentId])
    ).rows[0];
    if (!attempt) throw new GameError("not_found", "Partida não encontrada.");
    if (attempt.status !== "in_progress") throw new GameError("conflict", "Esta partida já terminou. Comece uma nova.");
    const game = await loadGame(db, String(attempt.game_id));
    const config = game ? parseGameConfig(game.config) : null;
    if (!game || !config) throw new GameError("invalid", "Este jogo está com a configuração incompleta.");

    if (isExpired(attempt)) {
      const result = await finalize(db, game, config, attempt, student, "time");
      return { expired: result, game };
    }

    const found = findChallenge(config, challengeId);
    if (!found) throw new GameError("invalid", "Desafio inválido.");
    const state = readState(attempt.state);
    const summary = summarize(config, state);
    if (!isPhaseOpen(summary, found.phaseIndex)) {
      throw new GameError("locked", "Termine a fase anterior (com a nota mínima) para liberar esta.");
    }
    const prev = state.challenges[challengeId];
    if (prev?.resolved) throw new GameError("conflict", "Este desafio já foi resolvido.");

    const grade = gradeChallenge(found.challenge, submission, attemptId);
    const outcome = applyGrade(found.challenge, prev, grade);
    state.challenges[challengeId] = outcome.next;

    const saved = (
      await db.query(
        `UPDATE game_attempts SET state = $3::jsonb, version = version + 1
         WHERE id = $1::uuid AND version = $2::int AND status = 'in_progress'
         RETURNING *`,
        [attemptId, Number(attempt.version), JSON.stringify(state)]
      )
    ).rows[0];
    if (!saved) throw new GameError("conflict", "Duas respostas chegaram ao mesmo tempo. Tente de novo.");

    return {
      expired: null,
      game,
      payload: {
        correct: grade.correct,
        percent: Math.round(grade.percent),
        feedback: grade.feedback,
        resolved: outcome.resolved,
        triesLeft: outcome.triesLeft,
        points: outcome.next.points,
        explain: outcome.resolved ? (found.challenge.explain ?? null) : null,
        open: buildOpenView(saved, config),
      },
    };
  });

  if (out.expired) {
    await reconcileMission(studentId, out.game, out.expired);
    return { correct: false, percent: 0, feedback: "", resolved: false, triesLeft: 0, points: 0, explain: null, expired: out.expired, open: null };
  }
  return { ...out.payload!, expired: null };
}

// ---- Encerrar ------------------------------------------------------------------------------------------------

const LEVEL_SQL = `UPDATE students SET level = CASE
  WHEN points >= 1000 THEN 5 WHEN points >= 600 THEN 4 WHEN points >= 300 THEN 3 WHEN points >= 100 THEN 2 ELSE 1 END
  WHERE id = $1::uuid`;

/**
 * Encerra uma partida e aplica TODAS as consequências na mesma transação:
 * situação, histórico, progresso do aluno, XP (uma única vez por jogo) e medalhas.
 * O `UPDATE ... WHERE status = 'in_progress'` inicial é a trava de idempotência:
 * só a primeira chamada passa; as demais devolvem o resultado já gravado.
 */
async function finalize(
  db: Db,
  game: GameRow,
  config: GameConfig,
  attempt: Record<string, unknown>,
  student: StudentCtx,
  reason: EndReason
): Promise<FinishedResult> {
  const attemptId = String(attempt.id);
  const summary = summarize(config, readState(attempt.state));
  const evaluation = evaluateFinish(summary, Number(game.pass_percent));
  const passed = evaluation.passed;

  const claimed = (
    await db.query(
      `UPDATE game_attempts SET status = $2, finished_at = now(), ended_reason = $3
       WHERE id = $1::uuid AND status = 'in_progress' RETURNING started_at`,
      [attemptId, passed ? "passed" : "failed", reason]
    )
  ).rows[0];
  if (!claimed) {
    const stored = (await db.query(`SELECT result FROM game_attempts WHERE id = $1::uuid`, [attemptId])).rows[0];
    return { ...(stored.result as FinishedResult), alreadyCompleted: true, xpAwarded: 0, newAchievements: [] };
  }

  // Progresso do aluno neste jogo.
  await db.query(
    `INSERT INTO student_game_progress (student_id, game_id, attempts, best_percent, completed, xp_awarded)
     VALUES ($1::uuid, $2::uuid, 0, 0, false, 0) ON CONFLICT (student_id, game_id) DO NOTHING`,
    [student.id, game.id]
  );
  const prog = (
    await db.query(`SELECT best_percent FROM student_game_progress WHERE student_id = $1::uuid AND game_id = $2::uuid`, [
      student.id,
      game.id,
    ])
  ).rows[0];
  const best = Math.max(Number(prog?.best_percent ?? 0), summary.percent);
  await db.query(
    `UPDATE student_game_progress SET attempts = attempts + 1, best_percent = $3::int, last_attempt_at = now()
     WHERE student_id = $1::uuid AND game_id = $2::uuid`,
    [student.id, game.id, best]
  );

  let xp = 0;
  let alreadyCompleted = false;
  let newAchievements: { name: string; icon: string | null }[] = [];
  if (passed) {
    const won = (
      await db.query(
        `UPDATE student_game_progress SET completed = true, completed_at = now(), xp_awarded = $3::int
         WHERE student_id = $1::uuid AND game_id = $2::uuid AND completed = false RETURNING student_id`,
        [student.id, game.id, Number(game.xp_reward)]
      )
    ).rows[0];
    if (won) {
      xp = Number(game.xp_reward);
      if (xp > 0) {
        await db.query(`UPDATE students SET points = points + $1::int WHERE id = $2::uuid`, [xp, student.id]);
        await db.query(`INSERT INTO scores (student_id, points, reason) VALUES ($1::uuid, $2::int, $3)`, [
          student.id,
          xp,
          `Jogo concluído: ${game.title}`,
        ]);
        await db.query(LEVEL_SQL, [student.id]);
      }
      const pending = (
        await db.query(
          `SELECT a.id, a.name, a.icon FROM achievements a
           LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.student_id = $1::uuid
           WHERE a.criteria_type = 'game_completed' AND a.criteria_game_id = $2::uuid
             AND a.audience = $3 AND sa.achievement_id IS NULL`,
          [student.id, game.id, student.audience]
        )
      ).rows;
      for (const a of pending) {
        await db.query(
          `INSERT INTO student_achievements (student_id, achievement_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
          [student.id, a.id]
        );
        newAchievements.push({ name: String(a.name), icon: (a.icon as string | null) ?? null });
      }
    } else {
      alreadyCompleted = true;
    }
  }
  if (!passed) newAchievements = [];

  const duration = Math.max(0, Math.round((Date.now() - new Date(claimed.started_at as string).getTime()) / 1000));
  const pts = (await db.query(`SELECT points FROM students WHERE id = $1::uuid`, [student.id])).rows[0];
  const result: FinishedResult = {
    attemptId,
    passed,
    endedReason: reason,
    percent: summary.percent,
    points: summary.earned,
    pointsPossible: summary.possible,
    stars: starsFor(summary.percent, passed),
    correctCount: summary.correctCount,
    wrongCount: summary.wrongCount,
    durationSeconds: duration,
    xpAwarded: xp,
    alreadyCompleted,
    summary,
    guidance: buildGuidance(summary, evaluation, Number(game.pass_percent), student.audience === "kids"),
    newAchievements,
    missionCompleted: false,
    totalPoints: Number(pts?.points ?? 0),
  };
  await db.query(
    `UPDATE game_attempts SET score_percent = $2::int, points = $3::int, points_possible = $4::int,
       correct_count = $5::int, wrong_count = $6::int, duration_seconds = $7::int, xp_awarded = $8::int,
       result = $9::jsonb
     WHERE id = $1::uuid`,
    [
      attemptId,
      summary.percent,
      summary.earned,
      summary.possible,
      summary.correctCount,
      summary.wrongCount,
      duration,
      xp,
      JSON.stringify(result),
    ]
  );
  return result;
}

/**
 * Jogo aprovado que "conclui a missão": reaproveita `completeMissionAttempt` (pontos,
 * competências, conquistas e nível da missão — idempotente). Roda DEPOIS do commit do jogo,
 * em transação própria; se falhar, a próxima aprovação reconcilia (nunca duplica).
 */
async function reconcileMission(studentId: string, game: GameRow, result: FinishedResult): Promise<void> {
  if (!result.passed || !game.completes_mission || !game.mission_id) return;
  await completeMissionAttempt(studentId, game.mission_id);
  result.missionCompleted = true;
}

export async function finishAttempt(studentId: string, attemptId: string): Promise<FinishedResult> {
  const { result, game } = await withTx(async (db) => {
    const student = await loadStudent(db, studentId);
    const attempt = (
      await db.query(`SELECT * FROM game_attempts WHERE id = $1::uuid AND student_id = $2::uuid`, [attemptId, studentId])
    ).rows[0];
    if (!attempt) throw new GameError("not_found", "Partida não encontrada.");
    const g = await loadGame(db, String(attempt.game_id));
    const config = g ? parseGameConfig(g.config) : null;
    if (!g || !config) throw new GameError("invalid", "Este jogo está com a configuração incompleta.");
    if (attempt.status !== "in_progress") {
      return { result: { ...(attempt.result as FinishedResult), alreadyCompleted: true, xpAwarded: 0, newAchievements: [] }, game: g };
    }
    const summary = summarize(config, readState(attempt.state));
    const expired = isExpired(attempt);
    if (!expired && !summary.allResolved && summary.blockedAtPhase === null) {
      throw new GameError("incomplete", "Ainda faltam desafios para terminar o jogo.");
    }
    return { result: await finalize(db, g, config, attempt, student, expired && !summary.allResolved && summary.blockedAtPhase === null ? "time" : "completed"), game: g };
  });
  await reconcileMission(studentId, game, result);
  return result;
}

// ---- Integração com missões ---------------------------------------------------------------------------------

/** Jogos publicados vinculados a missões (para o botão "Jogar" no cartão da missão). */
export async function listPublishedGamesByMission(missionIds: string[], audience: string): Promise<Record<string, { id: string; title: string }>> {
  if (missionIds.length === 0) return {};
  const rows = await query<{ id: string; title: string; mission_id: string }>(
    `SELECT id, title, mission_id FROM games
     WHERE status = 'published' AND mission_id IS NOT NULL AND (audience = 'all' OR audience = $1)
     ORDER BY sort_order, title`,
    [audience]
  );
  const wanted = new Set(missionIds);
  const out: Record<string, { id: string; title: string }> = {};
  for (const r of rows) {
    if (wanted.has(r.mission_id) && !out[r.mission_id]) out[r.mission_id] = { id: r.id, title: r.title };
  }
  return out;
}

const defaultDb: Db = {
  async query(text, params) {
    return { rows: await query(text, params) };
  },
};
