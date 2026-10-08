import { randomInt } from "crypto";
import { pool, query, queryOne } from "@/lib/db";
import {
  gradeActivity,
  scoreFromAttempts,
  toPublicConfig,
  type ActivityCategory,
  type ActivityKind,
  type LabSkill,
  type PublicConfig,
} from "@/lib/lab/activities";
import { computeEvaluation, skillStatus, type EvaluationResult, type SkillStatus } from "@/lib/lab/evaluation";
import { kidsLevel, type KidsLevelInfo } from "@/lib/levels";
import { LAB_SKILLS } from "@/lib/lab/activities";
import { listMissionTasksWithVideo, getMissionVideo, completeMissionAttempt } from "@/modules/missions/queries";
import type { MissionTaskWithVideo, MissionVideo, MissionWorkConfig } from "@/types";

/** Slug fixo da trilha do programa (mesmo valor do seed). */
export const LAB_TRACK_SLUG = "primeiros-passos-no-computador";
/** Nº da aula final (desafio "Meu Primeiro Projeto Digital"). */
export const FINAL_LESSON = 30;

export type LabErrorCode = "not_found" | "forbidden" | "locked" | "incomplete" | "work_required" | "invalid";

/** Erro de regra de negócio com mensagem pronta para mostrar à criança/equipe. */
export class LabError extends Error {
  constructor(
    public code: LabErrorCode,
    message: string
  ) {
    super(message);
    this.name = "LabError";
  }
}

/** Qualquer coisa com `query()` — o pool, um client de transação ou o pg-mem. */
export interface Db {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** Db que usa o pool padrão do projeto (sem transação). */
const defaultDb: Db = {
  async query(text, params) {
    return { rows: await query(text, params) };
  },
};

// ---- Tipos de retorno --------------------------------------------------------------

export type LessonState = "locked" | "available" | "in_progress" | "done";

export interface LabLessonSummary {
  id: string;
  number: number;
  title: string;
  moduleName: string;
  moduleOrder: number;
  estimatedMinutes: number | null;
  points: number;
  state: LessonState;
  activitiesTotal: number;
  activitiesDone: number;
}

export interface SkillProgress {
  skill: LabSkill;
  total: number;
  done: number;
  percent: number;
  status: SkillStatus;
}

export interface LabAchievementView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  earned_at: string | null;
}

export interface LabCertificate {
  code: string;
  score: number;
  workloadHours: number;
  issuedAt: string;
}

export interface LabOverview {
  trackId: string;
  trackName: string;
  student: { id: string; name: string; points: number };
  level: KidsLevelInfo;
  lessons: LabLessonSummary[];
  lessonsDone: number;
  lessonsTotal: number;
  nextLesson: LabLessonSummary | null;
  skills: SkillProgress[];
  achievements: LabAchievementView[];
  evaluation: EvaluationResult & { parts: { knowledge: number | null; practice: number | null; project: number | null } };
  certificate: LabCertificate | null;
}

export interface LabActivityView {
  id: string;
  code: string;
  kind: ActivityKind;
  category: ActivityCategory;
  skill: LabSkill;
  title: string;
  prompt: string;
  xp: number;
  /** Configuração SEM gabarito (ver `toPublicConfig`). */
  config: PublicConfig;
  completed: boolean;
  attempts: number;
  bestScore: number;
}

export interface LabLessonDetail {
  id: string;
  number: number;
  title: string;
  moduleName: string;
  context: string | null;
  objective: string | null;
  estimatedMinutes: number | null;
  points: number;
  steps: MissionTaskWithVideo[];
  video: MissionVideo | null;
  workConfig: MissionWorkConfig | null;
  /** Trabalho no editor já entregue (aulas de documento). */
  workSubmitted: boolean;
  workId: string | null;
  state: LessonState;
  activities: LabActivityView[];
  prevLessonId: string | null;
  nextLessonId: string | null;
}

// ---- Acesso ------------------------------------------------------------------------

interface LessonRow {
  id: string;
  number: number;
  title: string;
  points_value: number;
  context: string | null;
  objective: string | null;
  estimated_minutes: number | null;
  work_config: MissionWorkConfig | null;
  module_name: string;
  track_id: string;
}

async function getStudentAudience(db: Db, studentId: string): Promise<string | null> {
  const row = (await db.query(`SELECT audience FROM students WHERE id = $1::uuid`, [studentId])).rows[0];
  return (row?.audience as string | undefined) ?? null;
}

export async function getLabTrackId(db: Db = defaultDb): Promise<string | null> {
  const row = (
    await db.query(`SELECT id FROM tracks WHERE slug = $1 AND audience = 'kids' AND active`, [LAB_TRACK_SLUG])
  ).rows[0];
  return (row?.id as string | undefined) ?? null;
}

/**
 * Carrega a aula e garante, NO SERVIDOR, que: o aluno é do público infantil,
 * a aula é do programa e a aula anterior já foi concluída (liberação em
 * sequência). Refazer aulas já concluídas nunca é bloqueado.
 */
async function loadLessonForStudent(db: Db, studentId: string, missionId: string): Promise<LessonRow> {
  if ((await getStudentAudience(db, studentId)) !== "kids") {
    throw new LabError("forbidden", "Esta área é do ILTECN LAB.");
  }
  const lesson = (
    await db.query(
      `SELECT m.id, m.sort_order AS number, m.title, m.points_value, m.context, m.objective,
              m.estimated_minutes, m.work_config, mo.name AS module_name, mo.track_id
       FROM missions m
       JOIN modules mo ON mo.id = m.module_id
       JOIN tracks t ON t.id = mo.track_id
       WHERE m.id = $1::uuid AND m.active AND t.slug = $2 AND t.audience = 'kids'`,
      [missionId, LAB_TRACK_SLUG]
    )
  ).rows[0] as unknown as LessonRow | undefined;
  if (!lesson) throw new LabError("not_found", "Aula não encontrada.");

  if (lesson.number > 1) {
    const prev = (
      await db.query(
        `SELECT COALESCE(ma.status, 'disponivel') AS status
         FROM missions m
         JOIN modules mo ON mo.id = m.module_id
         LEFT JOIN mission_attempts ma ON ma.mission_id = m.id AND ma.student_id = $3::uuid
         WHERE mo.track_id = $1::uuid AND m.sort_order = $2::int AND m.active`,
        [lesson.track_id, lesson.number - 1, studentId]
      )
    ).rows[0];
    if (prev && prev.status !== "concluida") {
      throw new LabError("locked", "Termine a aula anterior para abrir esta. 🔒");
    }
  }
  return lesson;
}

// ---- Habilidades e avaliação ----------------------------------------------------------

interface SkillCountRow {
  skill: LabSkill;
  lesson: number;
  total: number;
}

/** Quantidade de atividades ativas por (habilidade, nº da aula) na trilha. */
async function activityCountsBySkillAndLesson(db: Db, trackId: string): Promise<SkillCountRow[]> {
  const rows = (
    await db.query(
      `SELECT a.skill, m.sort_order AS lesson, COUNT(*)::int AS total
       FROM mission_activities a
       JOIN missions m ON m.id = a.mission_id
       JOIN modules mo ON mo.id = m.module_id
       WHERE mo.track_id = $1::uuid AND a.active AND m.active
       GROUP BY a.skill, m.sort_order`,
      [trackId]
    )
  ).rows;
  return rows.map((r) => ({ skill: r.skill as LabSkill, lesson: Number(r.lesson), total: Number(r.total) }));
}

interface SkillDoneRow {
  skill: LabSkill;
  attempted: number;
  done: number;
}

async function skillProgressRows(db: Db, studentId: string, trackId: string): Promise<SkillDoneRow[]> {
  const rows = (
    await db.query(
      `SELECT a.skill, COUNT(*)::int AS attempted,
              COALESCE(SUM(CASE WHEN p.completed THEN 1 ELSE 0 END), 0)::int AS done
       FROM student_activity_progress p
       JOIN mission_activities a ON a.id = p.activity_id
       JOIN missions m ON m.id = a.mission_id
       JOIN modules mo ON mo.id = m.module_id
       WHERE p.student_id = $1::uuid AND mo.track_id = $2::uuid AND a.active AND m.active
       GROUP BY a.skill`,
      [studentId, trackId]
    )
  ).rows;
  return rows.map((r) => ({
    skill: r.skill as LabSkill,
    attempted: Number(r.attempted),
    done: Number(r.done),
  }));
}

/**
 * Resumo por habilidade. O status (🟢🟡🔴) compara o que a criança já fez com
 * o que ela JÁ ALCANÇOU (aulas até a atual) — não com o programa inteiro, para
 * não marcar como "precisa praticar" quem apenas ainda não chegou lá.
 * `percent` é o avanço no programa inteiro.
 */
export function buildSkillProgress(
  counts: SkillCountRow[],
  progress: SkillDoneRow[],
  reachedLesson: number
): SkillProgress[] {
  return LAB_SKILLS.map((skill) => {
    const total = counts.filter((c) => c.skill === skill).reduce((s, c) => s + c.total, 0);
    const reached = counts
      .filter((c) => c.skill === skill && c.lesson <= reachedLesson)
      .reduce((s, c) => s + c.total, 0);
    const p = progress.find((r) => r.skill === skill);
    const done = p?.done ?? 0;
    return {
      skill,
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      status: skillStatus({ completed: done, total: reached, attempted: p?.attempted ?? 0 }),
    };
  }).filter((s) => s.total > 0);
}

export async function getStudentEvaluation(db: Db, studentId: string, trackId: string) {
  const rows = (
    await db.query(
      `SELECT a.category, m.sort_order AS lesson, p.best_score
       FROM student_activity_progress p
       JOIN mission_activities a ON a.id = p.activity_id
       JOIN missions m ON m.id = a.mission_id
       JOIN modules mo ON mo.id = m.module_id
       WHERE p.student_id = $1::uuid AND mo.track_id = $2::uuid AND p.completed = true AND a.active`,
      [studentId, trackId]
    )
  ).rows;
  const avg = (list: number[]) =>
    list.length === 0 ? null : Math.round(list.reduce((s, n) => s + n, 0) / list.length);
  const scores = rows.map((r) => ({
    category: r.category as ActivityCategory,
    lesson: Number(r.lesson),
    score: Number(r.best_score),
  }));
  const parts = {
    knowledge: avg(scores.filter((s) => s.category === "knowledge").map((s) => s.score)),
    practice: avg(scores.filter((s) => s.category !== "knowledge" && s.lesson !== FINAL_LESSON).map((s) => s.score)),
    project: avg(scores.filter((s) => s.lesson === FINAL_LESSON).map((s) => s.score)),
  };
  return { ...computeEvaluation(parts), parts };
}

// ---- Conquistas do programa ------------------------------------------------------------

export interface EarnedAchievement {
  name: string;
  icon: string | null;
}

/**
 * Concede as conquistas do ILTECN LAB que o aluno já merece (idempotente).
 * Os critérios clássicos (`missions_completed`, `points`, `track_completed`)
 * continuam sendo concedidos por `completeMissionAttempt`.
 */
export async function grantLabAchievements(
  db: Db,
  studentId: string,
  trackId: string
): Promise<EarnedAchievement[]> {
  const pending = (
    await db.query(
      `SELECT a.id, a.name, a.icon, a.criteria_type, a.criteria_mission_id, a.criteria_skill
       FROM achievements a
       LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.student_id = $1::uuid
       WHERE a.audience = 'kids' AND sa.achievement_id IS NULL
         AND a.criteria_type IN ('track_started', 'mission_completed', 'skill_completed', 'challenges_completed')`,
      [studentId]
    )
  ).rows;
  if (pending.length === 0) return [];

  const earned: EarnedAchievement[] = [];
  for (const ach of pending) {
    let ok = false;
    switch (ach.criteria_type) {
      case "track_started": {
        const row = (
          await db.query(`SELECT COUNT(*)::int AS n FROM student_activity_progress WHERE student_id = $1::uuid`, [studentId])
        ).rows[0];
        const attempts = (
          await db.query(
            `SELECT COUNT(*)::int AS n FROM mission_attempts ma
             JOIN missions m ON m.id = ma.mission_id JOIN modules mo ON mo.id = m.module_id
             WHERE ma.student_id = $1::uuid AND mo.track_id = $2::uuid`,
            [studentId, trackId]
          )
        ).rows[0];
        ok = Number(row?.n) > 0 || Number(attempts?.n) > 0;
        break;
      }
      case "mission_completed": {
        const row = (
          await db.query(
            `SELECT COUNT(*)::int AS n FROM mission_attempts
             WHERE student_id = $1::uuid AND mission_id = $2::uuid AND status = 'concluida'`,
            [studentId, ach.criteria_mission_id]
          )
        ).rows[0];
        ok = Number(row?.n) > 0;
        break;
      }
      case "skill_completed": {
        const upto = (
          await db.query(`SELECT sort_order FROM missions WHERE id = $1::uuid`, [ach.criteria_mission_id])
        ).rows[0];
        if (!upto) break;
        const row = (
          await db.query(
            `SELECT COUNT(*)::int AS total,
                    COALESCE(SUM(CASE WHEN p.completed THEN 1 ELSE 0 END), 0)::int AS done
             FROM mission_activities a
             JOIN missions m ON m.id = a.mission_id
             JOIN modules mo ON mo.id = m.module_id
             LEFT JOIN student_activity_progress p ON p.activity_id = a.id AND p.student_id = $1::uuid
             WHERE mo.track_id = $2::uuid AND a.active AND a.skill = $3 AND m.sort_order <= $4::int`,
            [studentId, trackId, ach.criteria_skill, Number(upto.sort_order)]
          )
        ).rows[0];
        ok = Number(row?.total) > 0 && Number(row?.done) === Number(row?.total);
        break;
      }
      case "challenges_completed": {
        const row = (
          await db.query(
            `SELECT COUNT(*)::int AS total,
                    COALESCE(SUM(CASE WHEN p.completed THEN 1 ELSE 0 END), 0)::int AS done
             FROM mission_activities a
             JOIN missions m ON m.id = a.mission_id
             JOIN modules mo ON mo.id = m.module_id
             LEFT JOIN student_activity_progress p ON p.activity_id = a.id AND p.student_id = $1::uuid
             WHERE mo.track_id = $2::uuid AND a.active AND a.category = 'challenge'`,
            [studentId, trackId]
          )
        ).rows[0];
        ok = Number(row?.total) > 0 && Number(row?.done) === Number(row?.total);
        break;
      }
    }
    if (ok) {
      await db.query(
        `INSERT INTO student_achievements (student_id, achievement_id) VALUES ($1::uuid, $2::uuid)
         ON CONFLICT DO NOTHING`,
        [studentId, ach.id]
      );
      earned.push({ name: String(ach.name), icon: (ach.icon as string | null) ?? null });
    }
  }
  return earned;
}

// ---- Visão geral do aluno ---------------------------------------------------------------------

export async function getLabLessonList(db: Db, studentId: string, trackId: string): Promise<LabLessonSummary[]> {
  const rows = (
    await db.query(
      `SELECT m.id, m.sort_order AS number, m.title, m.points_value, m.estimated_minutes,
              mo.name AS module_name, mo.sort_order AS module_order,
              COALESCE(ma.status, 'disponivel') AS status
       FROM missions m
       JOIN modules mo ON mo.id = m.module_id
       LEFT JOIN mission_attempts ma ON ma.mission_id = m.id AND ma.student_id = $2::uuid
       WHERE mo.track_id = $1::uuid AND m.active AND mo.active
       ORDER BY m.sort_order ASC`,
      [trackId, studentId]
    )
  ).rows;

  const acts = (
    await db.query(
      `SELECT a.mission_id, COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN p.completed THEN 1 ELSE 0 END), 0)::int AS done,
              COALESCE(SUM(CASE WHEN p.activity_id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS touched
       FROM mission_activities a
       JOIN missions m ON m.id = a.mission_id
       JOIN modules mo ON mo.id = m.module_id
       LEFT JOIN student_activity_progress p ON p.activity_id = a.id AND p.student_id = $2::uuid
       WHERE mo.track_id = $1::uuid AND a.active
       GROUP BY a.mission_id`,
      [trackId, studentId]
    )
  ).rows;
  const byMission = new Map(acts.map((a) => [String(a.mission_id), a]));

  let previousDone = true;
  return rows.map((r) => {
    const a = byMission.get(String(r.id));
    const done = r.status === "concluida";
    let state: LessonState;
    if (done) state = "done";
    else if (!previousDone) state = "locked";
    else if (Number(a?.touched ?? 0) > 0 || r.status === "em_andamento") state = "in_progress";
    else state = "available";
    previousDone = done;
    return {
      id: String(r.id),
      number: Number(r.number),
      title: String(r.title),
      moduleName: String(r.module_name),
      moduleOrder: Number(r.module_order),
      estimatedMinutes: r.estimated_minutes === null ? null : Number(r.estimated_minutes),
      points: Number(r.points_value),
      state,
      activitiesTotal: Number(a?.total ?? 0),
      activitiesDone: Number(a?.done ?? 0),
    };
  });
}

export async function getCertificateForStudent(
  db: Db,
  studentId: string,
  trackId: string
): Promise<LabCertificate | null> {
  const row = (
    await db.query(
      `SELECT code, score, workload_hours, issued_at FROM track_certificates
       WHERE student_id = $1::uuid AND track_id = $2::uuid`,
      [studentId, trackId]
    )
  ).rows[0];
  if (!row) return null;
  return {
    code: String(row.code),
    score: Number(row.score),
    workloadHours: Number(row.workload_hours),
    issuedAt: new Date(row.issued_at as string).toISOString(),
  };
}

/** Painel do aluno: progresso, XP, nível, medalhas, habilidades e próxima aula. */
export async function getLabOverview(studentId: string, db: Db = defaultDb): Promise<LabOverview | null> {
  if ((await getStudentAudience(db, studentId)) !== "kids") return null;
  const track = (
    await db.query(`SELECT id, name FROM tracks WHERE slug = $1 AND audience = 'kids' AND active`, [LAB_TRACK_SLUG])
  ).rows[0];
  if (!track) return null;
  const trackId = String(track.id);

  const student = (
    await db.query(
      `SELECT s.id, s.points, u.name FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1::uuid`,
      [studentId]
    )
  ).rows[0];
  if (!student) return null;

  // Abrir o programa pela primeira vez já vale a medalha "Primeiro acesso".
  const first = (
    await db.query(
      `SELECT m.id FROM missions m JOIN modules mo ON mo.id = m.module_id
       WHERE mo.track_id = $1::uuid AND m.sort_order = 1 AND m.active`,
      [trackId]
    )
  ).rows[0];
  if (first) {
    await db.query(
      `INSERT INTO mission_attempts (student_id, mission_id, status, started_at)
       VALUES ($1::uuid, $2::uuid, 'disponivel', now())
       ON CONFLICT (student_id, mission_id) DO NOTHING`,
      [studentId, first.id]
    );
  }
  await grantLabAchievements(db, studentId, trackId);

  const lessons = await getLabLessonList(db, studentId, trackId);
  const lessonsDone = lessons.filter((l) => l.state === "done").length;
  const nextLesson = lessons.find((l) => l.state !== "done") ?? null;

  const [counts, progress] = await Promise.all([
    activityCountsBySkillAndLesson(db, trackId),
    skillProgressRows(db, studentId, trackId),
  ]);
  const skills = buildSkillProgress(counts, progress, (nextLesson?.number ?? lessons.length) || 1);

  const achievements = (
    await db.query(
      `SELECT a.id, a.code, a.name, a.description, a.icon, sa.earned_at
       FROM achievements a
       LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.student_id = $1::uuid
       WHERE a.audience = 'kids'
       ORDER BY (sa.earned_at IS NULL), sa.earned_at DESC, a.name ASC`,
      [studentId]
    )
  ).rows.map((a) => ({
    id: String(a.id),
    code: String(a.code),
    name: String(a.name),
    description: (a.description as string | null) ?? null,
    icon: (a.icon as string | null) ?? null,
    earned_at: a.earned_at ? new Date(a.earned_at as string).toISOString() : null,
  }));

  return {
    trackId,
    trackName: String(track.name),
    student: { id: String(student.id), name: String(student.name), points: Number(student.points) },
    level: kidsLevel(Number(student.points)),
    lessons,
    lessonsDone,
    lessonsTotal: lessons.length,
    nextLesson,
    skills,
    achievements,
    evaluation: await getStudentEvaluation(db, studentId, trackId),
    certificate: await getCertificateForStudent(db, studentId, trackId),
  };
}

// ---- Aula ----------------------------------------------------------------------------------

export async function getLabLesson(studentId: string, missionId: string, db: Db = defaultDb): Promise<LabLessonDetail> {
  const lesson = await loadLessonForStudent(db, studentId, missionId);

  const activityRows = (
    await db.query(
      `SELECT a.id, a.code, a.kind, a.category, a.skill, a.title, a.prompt, a.config, a.xp,
              p.completed, p.attempts, p.best_score
       FROM mission_activities a
       LEFT JOIN student_activity_progress p ON p.activity_id = a.id AND p.student_id = $2::uuid
       WHERE a.mission_id = $1::uuid AND a.active
       ORDER BY a.sort_order ASC, a.code ASC`,
      [missionId, studentId]
    )
  ).rows;

  const activities: LabActivityView[] = activityRows.map((a) => ({
    id: String(a.id),
    code: String(a.code),
    kind: a.kind as ActivityKind,
    category: a.category as ActivityCategory,
    skill: a.skill as LabSkill,
    title: String(a.title),
    prompt: String(a.prompt),
    xp: Number(a.xp),
    // O gabarito NUNCA sai do servidor: só a configuração pública.
    config: toPublicConfig(a.kind as ActivityKind, a.config, `${studentId}:${a.code}`),
    completed: Boolean(a.completed),
    attempts: Number(a.attempts ?? 0),
    bestScore: Number(a.best_score ?? 0),
  }));

  const list = await getLabLessonList(db, studentId, lesson.track_id);
  const idx = list.findIndex((l) => l.id === missionId);
  const state = list[idx]?.state ?? "available";

  let workSubmitted = false;
  let workId: string | null = null;
  if (lesson.work_config) {
    const work = (
      await db.query(
        `SELECT id, status FROM student_works WHERE student_id = $1::uuid AND mission_id = $2::uuid AND work_type = $3`,
        [studentId, missionId, lesson.work_config.workType]
      )
    ).rows[0];
    if (work) {
      workId = String(work.id);
      workSubmitted = ["SUBMITTED", "APPROVED"].includes(String(work.status));
    }
  }

  return {
    id: lesson.id,
    number: Number(lesson.number),
    title: lesson.title,
    moduleName: lesson.module_name,
    context: lesson.context,
    objective: lesson.objective,
    estimatedMinutes: lesson.estimated_minutes === null ? null : Number(lesson.estimated_minutes),
    points: Number(lesson.points_value),
    steps: await listMissionTasksWithVideo(missionId),
    video: await getMissionVideo(missionId),
    workConfig: lesson.work_config,
    workSubmitted,
    workId,
    state,
    activities,
    prevLessonId: idx > 0 ? list[idx - 1].id : null,
    nextLessonId: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
  };
}

// ---- Enviar uma atividade ----------------------------------------------------------------------------

export interface SubmitActivityResult {
  correct: boolean;
  /** % certo nesta tentativa (0–100). */
  percent: number;
  feedback: string;
  /** XP ganho agora (0 se já tinha concluído antes ou se errou). */
  xpAwarded: number;
  alreadyCompleted: boolean;
  /** Nota final da atividade quando concluída agora. */
  score: number | null;
  attempts: number;
  newAchievements: EarnedAchievement[];
  totalPoints: number;
  level: KidsLevelInfo;
}

/**
 * Corrige a atividade NO SERVIDOR e registra a tentativa. O XP só é pago na
 * primeira vez que a criança acerta (garantido por UPDATE ... WHERE
 * completed = false, que só uma requisição consegue ganhar).
 */
export async function submitActivity(
  studentId: string,
  activityId: string,
  submission: unknown
): Promise<SubmitActivityResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const db: Db = client as unknown as Db;

    const act = (
      await db.query(
        `SELECT a.id, a.code, a.kind, a.title, a.config, a.xp, a.mission_id, mo.track_id
         FROM mission_activities a
         JOIN missions m ON m.id = a.mission_id
         JOIN modules mo ON mo.id = m.module_id
         WHERE a.id = $1::uuid AND a.active AND m.active`,
        [activityId]
      )
    ).rows[0];
    if (!act) throw new LabError("not_found", "Atividade não encontrada.");
    await loadLessonForStudent(db, studentId, String(act.mission_id));

    const grade = gradeActivity(act.kind as ActivityKind, act.config, submission, `${studentId}:${act.code}`);

    await db.query(
      `INSERT INTO student_activity_progress (student_id, activity_id, attempts, best_score, completed)
       VALUES ($1::uuid, $2::uuid, 0, 0, false)
       ON CONFLICT (student_id, activity_id) DO NOTHING`,
      [studentId, activityId]
    );
    const prog = (
      await db.query(
        `SELECT attempts, best_score, completed FROM student_activity_progress
         WHERE student_id = $1::uuid AND activity_id = $2::uuid`,
        [studentId, activityId]
      )
    ).rows[0];
    const attemptsBefore = Number(prog?.attempts ?? 0);

    // A aula passa a "em andamento" assim que a criança tenta algo.
    await db.query(
      `INSERT INTO mission_attempts (student_id, mission_id, status, started_at)
       VALUES ($1::uuid, $2::uuid, 'em_andamento', now())
       ON CONFLICT (student_id, mission_id) DO UPDATE SET
         status = CASE WHEN mission_attempts.status = 'disponivel' THEN 'em_andamento' ELSE mission_attempts.status END,
         started_at = COALESCE(mission_attempts.started_at, now())`,
      [studentId, act.mission_id]
    );

    let xpAwarded = 0;
    let score: number | null = null;
    let alreadyCompleted = Boolean(prog?.completed);
    let attempts = attemptsBefore + 1;

    if (alreadyCompleted) {
      await db.query(
        `UPDATE student_activity_progress SET attempts = attempts + 1, last_attempt_at = now()
         WHERE student_id = $1::uuid AND activity_id = $2::uuid`,
        [studentId, activityId]
      );
    } else if (grade.correct) {
      score = scoreFromAttempts(attemptsBefore);
      const won = (
        await db.query(
          `UPDATE student_activity_progress
           SET attempts = attempts + 1, best_score = $3::int, completed = true,
               completed_at = now(), last_attempt_at = now()
           WHERE student_id = $1::uuid AND activity_id = $2::uuid AND completed = false
           RETURNING attempts`,
          [studentId, activityId, score]
        )
      ).rows[0];
      if (won) {
        attempts = Number(won.attempts);
        xpAwarded = Number(act.xp);
        await db.query(`UPDATE students SET points = points + $1::int WHERE id = $2::uuid`, [xpAwarded, studentId]);
        await db.query(`INSERT INTO scores (student_id, points, reason) VALUES ($1::uuid, $2::int, $3)`, [
          studentId,
          xpAwarded,
          `Atividade concluída: ${act.title}`,
        ]);
      } else {
        // Outra requisição concluiu antes: não paga XP duas vezes.
        alreadyCompleted = true;
        score = null;
      }
    } else {
      const partial = Math.min(99, Math.max(Number(prog?.best_score ?? 0), Math.floor(grade.percent)));
      await db.query(
        `UPDATE student_activity_progress
         SET attempts = attempts + 1, best_score = $3::int, last_attempt_at = now()
         WHERE student_id = $1::uuid AND activity_id = $2::uuid`,
        [studentId, activityId, partial]
      );
    }

    const newAchievements = xpAwarded > 0 ? await grantLabAchievements(db, studentId, String(act.track_id)) : [];
    const pts = (await db.query(`SELECT points FROM students WHERE id = $1::uuid`, [studentId])).rows[0];
    await client.query("COMMIT");

    const totalPoints = Number(pts?.points ?? 0);
    return {
      correct: grade.correct,
      percent: Math.round(grade.percent),
      feedback: grade.feedback,
      xpAwarded,
      alreadyCompleted,
      score,
      attempts,
      newAchievements,
      totalPoints,
      level: kidsLevel(totalPoints),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---- Concluir a aula ------------------------------------------------------------------------------------

export interface CompleteLessonResult {
  alreadyCompleted: boolean;
  pointsAwarded: number;
  newAchievements: EarnedAchievement[];
  nextLessonId: string | null;
  certificate: LabCertificate | null;
}

/** Código do certificado: legível, sem letras confundíveis (0/O, 1/I). */
export function generateCertificateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(alphabet.length)];
  return `ILT-${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Emite o certificado quando as 30 aulas estão concluídas. Idempotente
 * (um por aluno+trilha): chamar de novo devolve o que já existe.
 */
export async function issueCertificateIfEligible(
  db: Db,
  studentId: string,
  trackId: string
): Promise<LabCertificate | null> {
  const existing = await getCertificateForStudent(db, studentId, trackId);
  if (existing) return existing;

  const lessons = await getLabLessonList(db, studentId, trackId);
  if (lessons.length === 0 || lessons.some((l) => l.state !== "done")) return null;

  const evaluation = await getStudentEvaluation(db, studentId, trackId);
  const info = (
    await db.query(
      `SELECT u.name AS student_name, sc.name AS school_name, t.name AS track_name
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN schools sc ON sc.id = s.school_id
       JOIN tracks t ON t.id = $2::uuid
       WHERE s.id = $1::uuid`,
      [studentId, trackId]
    )
  ).rows[0];
  if (!info) return null;

  const snapshot = {
    studentName: info.student_name,
    schoolName: info.school_name,
    trackName: info.track_name,
    lessons: lessons.length,
    evaluationLabel: evaluation.label,
    parts: evaluation.parts,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCertificateCode();
    await db.query(
      `INSERT INTO track_certificates (student_id, track_id, code, score, workload_hours, snapshot)
       VALUES ($1::uuid, $2::uuid, $3, $4::int, 30, $5::jsonb)
       ON CONFLICT DO NOTHING`,
      [studentId, trackId, code, evaluation.score, JSON.stringify(snapshot)]
    );
    const saved = await getCertificateForStudent(db, studentId, trackId);
    if (saved) return saved;
  }
  return null;
}

/**
 * Conclui a aula reaproveitando o motor de missões (`completeMissionAttempt`:
 * pontos, nível, scores e conquistas clássicas). Antes disso o servidor exige
 * que todas as atividades estejam feitas e, nas aulas de documento, que o
 * trabalho tenha sido entregue.
 */
export async function completeLabLesson(studentId: string, missionId: string): Promise<CompleteLessonResult> {
  const db = defaultDb;
  const lesson = await loadLessonForStudent(db, studentId, missionId);

  const before = (
    await db.query(
      `SELECT status FROM mission_attempts WHERE student_id = $1::uuid AND mission_id = $2::uuid`,
      [studentId, missionId]
    )
  ).rows[0];
  const wasDone = before?.status === "concluida";

  if (!wasDone) {
    const left = (
      await db.query(
        `SELECT COUNT(*)::int AS n
         FROM mission_activities a
         LEFT JOIN student_activity_progress p ON p.activity_id = a.id AND p.student_id = $2::uuid
         WHERE a.mission_id = $1::uuid AND a.active AND COALESCE(p.completed, false) = false`,
        [missionId, studentId]
      )
    ).rows[0];
    if (Number(left?.n) > 0) {
      throw new LabError("incomplete", "Faltam algumas atividades. Você está quase lá! 💪");
    }
    if (lesson.work_config) {
      const work = (
        await db.query(
          `SELECT status FROM student_works
           WHERE student_id = $1::uuid AND mission_id = $2::uuid AND work_type = $3`,
          [studentId, missionId, lesson.work_config.workType]
        )
      ).rows[0];
      if (!work || !["SUBMITTED", "APPROVED"].includes(String(work.status))) {
        throw new LabError("work_required", "Entregue o seu trabalho no editor para concluir esta aula. 📄");
      }
    }
    await completeMissionAttempt(studentId, missionId);
  }

  const newAchievements = await grantLabAchievements(db, studentId, lesson.track_id);
  const certificate = await issueCertificateIfEligible(db, studentId, lesson.track_id);
  const list = await getLabLessonList(db, studentId, lesson.track_id);
  const idx = list.findIndex((l) => l.id === missionId);

  return {
    alreadyCompleted: wasDone,
    pointsAwarded: wasDone ? 0 : Number(lesson.points_value),
    newAchievements,
    nextLessonId: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
    certificate,
  };
}

// ---- Certificado (validação pública) ------------------------------------------------------------------------

export interface PublicCertificate {
  code: string;
  /** Nome reduzido (primeiro nome + inicial) — mínimo de dado de criança. */
  studentLabel: string;
  schoolName: string;
  trackName: string;
  workloadHours: number;
  evaluationLabel: string;
  issuedAt: string;
}

/** Reduz "Maria Aparecida Souza" para "Maria S." na página pública. */
export function shortenName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export async function validateCertificate(code: string): Promise<PublicCertificate | null> {
  const clean = code.trim().toUpperCase();
  if (!/^ILT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)) return null;
  const row = await queryOne<{
    code: string;
    workload_hours: number;
    issued_at: string;
    snapshot: { studentName: string; schoolName: string; trackName: string; evaluationLabel: string };
  }>(`SELECT code, workload_hours, issued_at, snapshot FROM track_certificates WHERE code = $1`, [clean]);
  if (!row) return null;
  return {
    code: row.code,
    studentLabel: shortenName(row.snapshot.studentName),
    schoolName: row.snapshot.schoolName,
    trackName: row.snapshot.trackName,
    workloadHours: Number(row.workload_hours),
    evaluationLabel: row.snapshot.evaluationLabel,
    issuedAt: new Date(row.issued_at).toISOString(),
  };
}

/** Dados completos do certificado do próprio aluno (para imprimir). */
export async function getOwnCertificate(studentId: string) {
  const row = await queryOne<{
    code: string;
    score: number;
    workload_hours: number;
    issued_at: string;
    snapshot: { studentName: string; schoolName: string; trackName: string; evaluationLabel: string };
  }>(
    `SELECT c.code, c.score, c.workload_hours, c.issued_at, c.snapshot
     FROM track_certificates c JOIN tracks t ON t.id = c.track_id
     WHERE c.student_id = $1 AND t.slug = $2`,
    [studentId, LAB_TRACK_SLUG]
  );
  return row
    ? {
        code: row.code,
        score: Number(row.score),
        workloadHours: Number(row.workload_hours),
        issuedAt: new Date(row.issued_at).toISOString(),
        ...row.snapshot,
      }
    : null;
}
