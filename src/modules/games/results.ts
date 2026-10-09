import { query } from "@/lib/db";
import {
  allChallenges,
  parseGameConfig,
  readState,
  skillLabel,
  type GameConfig,
} from "@/lib/games/engine";
import type { UserRole } from "@/types";

export interface Actor {
  userId: string;
  role: UserRole;
}

export const STAFF_ROLES: UserRole[] = ["admin", "teacher", "coordinator"];

interface ScopedStudent {
  id: string;
  name: string;
  school_name: string;
  class_name: string | null;
}

/**
 * Alunos que ESTE usuário pode acompanhar — o isolamento é feito no SQL:
 *  admin: todos · coordenador: a sua escola · professor: as suas turmas · demais: ninguém.
 * Só entram alunos do público do jogo.
 */
export async function listScopedStudents(
  actor: Actor,
  gameAudience: string,
  filter: { classId?: string } = {}
): Promise<ScopedStudent[]> {
  const params: unknown[] = [gameAudience];
  let scope = "";
  let classJoin = "LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active' LEFT JOIN classes cl ON cl.id = e.class_id";

  if (actor.role === "admin") {
    // sem restrição
  } else if (actor.role === "coordinator") {
    params.push(actor.userId);
    scope = `AND s.school_id IN (SELECT school_id FROM coordinators WHERE user_id = $${params.length}::uuid)`;
  } else if (actor.role === "teacher") {
    params.push(actor.userId);
    classJoin =
      "JOIN enrollments e ON e.student_id = s.id AND e.status = 'active' JOIN classes cl ON cl.id = e.class_id JOIN teachers t ON t.id = cl.teacher_id";
    scope = `AND t.user_id = $${params.length}::uuid`;
  } else {
    return [];
  }
  if (filter.classId) {
    params.push(filter.classId);
    scope += ` AND cl.id = $${params.length}::uuid`;
    if (actor.role !== "teacher") {
      classJoin = "JOIN enrollments e ON e.student_id = s.id AND e.status = 'active' JOIN classes cl ON cl.id = e.class_id";
    }
  }
  const rows = await query<ScopedStudent>(
    `SELECT s.id, u.name, sc.name AS school_name, cl.name AS class_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN schools sc ON sc.id = s.school_id
     ${classJoin}
     WHERE ($1 = 'all' OR s.audience = $1) ${scope}
     ORDER BY u.name ASC`,
    params
  );
  const seen = new Map<string, ScopedStudent>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()];
}

export type StudentGameStatus = "not_started" | "in_progress" | "failed" | "completed";

export interface StudentGameRow {
  id: string;
  name: string;
  className: string | null;
  schoolName: string;
  status: StudentGameStatus;
  attempts: number;
  bestPercent: number;
  lastPercent: number | null;
  lastAt: string | null;
  skills: { skill: string; label: string; emoji: string; percent: number }[];
  /** Percentual de cada partida terminada, da mais antiga para a mais nova. */
  evolution: number[];
  needsSupport: string | null;
}

export interface HardChallenge {
  challengeId: string;
  title: string;
  phaseTitle: string;
  skill: string;
  skillLabel: string;
  wrongRate: number;
  wrongTries: number;
  students: number;
}

export interface GameResults {
  game: { id: string; title: string; passPercent: number; status: string };
  totals: {
    students: number;
    started: number;
    inProgress: number;
    completed: number;
    needSupport: number;
    avgBestPercent: number | null;
    avgAttempts: number | null;
  };
  students: StudentGameRow[];
  hardest: HardChallenge[];
  skills: { skill: string; label: string; emoji: string; avgPercent: number }[];
}

export class ResultsError extends Error {
  constructor(
    public code: "forbidden" | "not_found",
    message: string
  ) {
    super(message);
  }
}

function placeholders(start: number, n: number) {
  return Array.from({ length: n }, (_, i) => `$${start + i}::uuid`).join(", ");
}

/** Resultados de um jogo para a equipe. Nunca devolve respostas de um aluno a outro: só números. */
export async function getGameResults(actor: Actor, gameId: string, filter: { classId?: string } = {}): Promise<GameResults> {
  if (!STAFF_ROLES.includes(actor.role)) throw new ResultsError("forbidden", "Acesso restrito à equipe.");
  const game = (
    await query<{ id: string; title: string; pass_percent: number; status: string; audience: string; config: unknown }>(
      `SELECT id, title, pass_percent, status, audience, config FROM games WHERE id = $1::uuid`,
      [gameId]
    )
  )[0];
  // Rascunho só o administrador enxerga.
  if (!game || (game.status !== "published" && actor.role !== "admin")) {
    throw new ResultsError("not_found", "Jogo não encontrado.");
  }
  const config = parseGameConfig(game.config);
  const students = await listScopedStudents(actor, game.audience, filter);
  const base: GameResults = {
    game: { id: game.id, title: game.title, passPercent: Number(game.pass_percent), status: game.status },
    totals: { students: students.length, started: 0, inProgress: 0, completed: 0, needSupport: 0, avgBestPercent: null, avgAttempts: null },
    students: [],
    hardest: [],
    skills: [],
  };
  if (students.length === 0) return base;

  const ids = students.map((s) => s.id);
  const attempts = await query<{
    student_id: string;
    status: string;
    state: unknown;
    score_percent: number | null;
    finished_at: string | null;
    started_at: string;
    result: { summary?: { skills?: { skill: string; percent: number }[] } } | null;
  }>(
    `SELECT student_id, status, state, score_percent, finished_at, started_at, result
     FROM game_attempts WHERE game_id = $1::uuid AND student_id IN (${placeholders(2, ids.length)})
     ORDER BY started_at ASC`,
    [gameId, ...ids]
  );
  const progress = await query<{ student_id: string; completed: boolean; best_percent: number; attempts: number }>(
    `SELECT student_id, completed, best_percent, attempts FROM student_game_progress
     WHERE game_id = $1::uuid AND student_id IN (${placeholders(2, ids.length)})`,
    [gameId, ...ids]
  );
  const progById = new Map(progress.map((p) => [p.student_id, p]));
  const byStudent = new Map<string, typeof attempts>();
  for (const a of attempts) byStudent.set(a.student_id, [...(byStudent.get(a.student_id) ?? []), a]);

  const hardAgg = new Map<string, { tries: number; wrong: number; students: Set<string> }>();
  const skillAgg = new Map<string, { sum: number; n: number }>();
  const rows: StudentGameRow[] = [];

  for (const s of students) {
    const list = byStudent.get(s.id) ?? [];
    const prog = progById.get(s.id);
    const finished = list.filter((a) => a.status !== "in_progress");
    const open = list.some((a) => a.status === "in_progress");
    const last = finished[finished.length - 1];

    for (const a of list) {
      for (const [cid, st] of Object.entries(readState(a.state).challenges)) {
        const agg = hardAgg.get(cid) ?? { tries: 0, wrong: 0, students: new Set<string>() };
        agg.tries += st.tries;
        const wrong = st.tries - (st.correct ? 1 : 0);
        agg.wrong += wrong;
        if (wrong > 0) agg.students.add(s.id);
        hardAgg.set(cid, agg);
      }
    }

    const skills = (last?.result?.summary?.skills ?? []).map((k) => ({
      skill: k.skill,
      percent: k.percent,
      ...skillLabel(k.skill),
    }));
    for (const k of skills) {
      const agg = skillAgg.get(k.skill) ?? { sum: 0, n: 0 };
      agg.sum += k.percent;
      agg.n += 1;
      skillAgg.set(k.skill, agg);
    }

    const completed = Boolean(prog?.completed);
    const status: StudentGameStatus = completed ? "completed" : open ? "in_progress" : finished.length ? "failed" : "not_started";
    const attemptsCount = Number(prog?.attempts ?? 0);
    const lastPercent = last?.score_percent === null || last?.score_percent === undefined ? null : Number(last.score_percent);
    let needsSupport: string | null = null;
    if (!completed && attemptsCount >= 2) needsSupport = `${attemptsCount} tentativas sem aprovação`;
    else if (!completed && lastPercent !== null && lastPercent < Number(game.pass_percent) - 25) {
      needsSupport = `Última partida com ${lastPercent}%`;
    }
    rows.push({
      id: s.id,
      name: s.name,
      className: s.class_name,
      schoolName: s.school_name,
      status,
      attempts: attemptsCount,
      bestPercent: Number(prog?.best_percent ?? 0),
      lastPercent,
      lastAt: last?.finished_at ? new Date(last.finished_at).toISOString() : null,
      skills: skills.map((k) => ({ skill: k.skill, label: k.label, emoji: k.emoji, percent: k.percent })),
      evolution: finished.map((a) => Number(a.score_percent ?? 0)),
      needsSupport,
    });
  }

  const started = rows.filter((r) => r.status !== "not_started");
  base.students = rows;
  base.totals = {
    students: rows.length,
    started: started.length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    completed: rows.filter((r) => r.status === "completed").length,
    needSupport: rows.filter((r) => r.needsSupport).length,
    avgBestPercent: started.length ? Math.round(started.reduce((n, r) => n + r.bestPercent, 0) / started.length) : null,
    avgAttempts: started.length ? Math.round((started.reduce((n, r) => n + r.attempts, 0) / started.length) * 10) / 10 : null,
  };
  base.skills = [...skillAgg.entries()]
    .map(([skill, v]) => ({ skill, ...skillLabel(skill), avgPercent: Math.round(v.sum / v.n) }))
    .sort((a, b) => a.avgPercent - b.avgPercent);
  base.hardest = config ? hardest(config, hardAgg) : [];
  return base;
}

function hardest(config: GameConfig, agg: Map<string, { tries: number; wrong: number; students: Set<string> }>): HardChallenge[] {
  const phaseOf = new Map<string, string>();
  for (const p of config.phases) for (const c of p.challenges) phaseOf.set(c.id, p.title);
  return allChallenges(config)
    .map((c) => {
      const a = agg.get(c.id);
      return {
        challengeId: c.id,
        title: c.title,
        phaseTitle: phaseOf.get(c.id) ?? "",
        skill: c.skill,
        skillLabel: skillLabel(c.skill).label,
        wrongRate: a && a.tries > 0 ? Math.round((a.wrong / a.tries) * 100) : 0,
        wrongTries: a?.wrong ?? 0,
        students: a?.students.size ?? 0,
      };
    })
    .filter((h) => h.wrongTries > 0)
    .sort((x, y) => y.wrongRate - x.wrongRate || y.wrongTries - x.wrongTries)
    .slice(0, 5);
}

export interface StaffGameListItem {
  id: string;
  code: string;
  title: string;
  status: string;
  audience: string;
  difficulty: string;
  missionTitle: string | null;
}

/** Jogos que o usuário pode consultar: o administrador vê todos; professor/coordenador, só os publicados. */
export async function listGamesForStaff(actor: Actor): Promise<StaffGameListItem[]> {
  if (!STAFF_ROLES.includes(actor.role)) return [];
  const rows = await query<{
    id: string; code: string; title: string; status: string; audience: string; difficulty: string; mission_title: string | null;
  }>(
    `SELECT g.id, g.code, g.title, g.status, g.audience, g.difficulty, mi.title AS mission_title
     FROM games g LEFT JOIN missions mi ON mi.id = g.mission_id
     ${actor.role === "admin" ? "" : "WHERE g.status = 'published'"}
     ORDER BY g.sort_order, g.title`
  );
  return rows.map((r) => ({
    id: r.id, code: r.code, title: r.title, status: r.status, audience: r.audience,
    difficulty: r.difficulty, missionTitle: r.mission_title,
  }));
}

/** Turmas que o usuário pode filtrar (mesmo escopo do SQL de `listScopedStudents`). */
export async function listActorClasses(actor: Actor): Promise<{ id: string; name: string }[]> {
  if (actor.role === "admin") return query(`SELECT id, name FROM classes WHERE active ORDER BY name ASC`);
  if (actor.role === "teacher") {
    return query(
      `SELECT c.id, c.name FROM classes c JOIN teachers t ON t.id = c.teacher_id WHERE t.user_id = $1::uuid AND c.active ORDER BY c.name ASC`,
      [actor.userId]
    );
  }
  if (actor.role === "coordinator") {
    return query(
      `SELECT c.id, c.name FROM classes c JOIN coordinators co ON co.school_id = c.school_id WHERE co.user_id = $1::uuid AND c.active ORDER BY c.name ASC`,
      [actor.userId]
    );
  }
  return [];
}
