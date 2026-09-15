import { pool, query, queryOne } from "@/lib/db";
import type {
  Mission,
  MissionTask,
  MissionAttemptStatus,
  MissionTaskVideo,
  MissionTaskWithVideo,
  TrackWithModules,
  VideoProvider,
  VideoType,
} from "@/types";

export async function listMissionsByModule(moduleId: string): Promise<Mission[]> {
  return query<Mission>(
    `SELECT id, module_id, title, context, objective, level, points_value,
            estimated_minutes, sort_order, active, resource_url, work_config
     FROM missions WHERE module_id = $1 ORDER BY sort_order ASC`,
    [moduleId]
  );
}

export interface CreateMissionInput {
  moduleId: string;
  title: string;
  context?: string;
  objective?: string;
  level?: number;
  pointsValue?: number;
  sortOrder?: number;
  resourceUrl?: string;
  tasks: string[];
  competencyIds: string[];
}

export async function createMission(input: CreateMissionInput): Promise<Mission> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const missionResult = await client.query<Mission>(
      `INSERT INTO missions (module_id, title, context, objective, level, points_value, sort_order, resource_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, module_id, title, context, objective, level, points_value,
                 estimated_minutes, sort_order, active, resource_url, work_config`,
      [
        input.moduleId,
        input.title,
        input.context ?? null,
        input.objective ?? null,
        input.level ?? 1,
        input.pointsValue ?? 100,
        input.sortOrder ?? 0,
        input.resourceUrl ?? null,
      ]
    );
    const mission = missionResult.rows[0];

    for (let i = 0; i < input.tasks.length; i++) {
      const description = input.tasks[i].trim();
      if (!description) continue;
      await client.query(
        `INSERT INTO mission_tasks (mission_id, description, sort_order) VALUES ($1, $2, $3)`,
        [mission.id, description, i + 1]
      );
    }

    for (const competencyId of input.competencyIds) {
      await client.query(
        `INSERT INTO mission_competencies (mission_id, competency_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [mission.id, competencyId]
      );
    }

    await client.query("COMMIT");
    return mission;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listMissionTasks(missionId: string): Promise<MissionTask[]> {
  return query<MissionTask>(
    `SELECT id, mission_id, description, sort_order
     FROM mission_tasks WHERE mission_id = $1 ORDER BY sort_order ASC`,
    [missionId]
  );
}

export async function getMissionTaskById(taskId: string): Promise<MissionTask | null> {
  return queryOne<MissionTask>(
    `SELECT id, mission_id, description, sort_order FROM mission_tasks WHERE id = $1`,
    [taskId]
  );
}

// ---- Fase 10.1: vídeos didáticos por etapa ----

const VIDEO_COLUMNS = `id, mission_task_id, title, description, video_url, thumbnail_url,
                        duration_seconds, provider, video_type, active`;

/**
 * Etapas (`mission_tasks`) de uma missão, cada uma com o vídeo associado (se
 * houver). `mission_tasks` já existia desde o início do projeto mas nunca
 * tinha sido exposta para o aluno — esta é a primeira vez que a etapa em si
 * vira um dado lido pela aplicação, não só gravado na criação da missão.
 * Duas consultas simples em vez de um JOIN com agregação em JSON: mantém a
 * lógica de junção no lado do app e evita depender de função de JSON do
 * Postgres que precisaria ser replicada no pg-mem dos testes.
 */
export async function listMissionTasksWithVideo(
  missionId: string
): Promise<MissionTaskWithVideo[]> {
  const tasks = await query<MissionTask>(
    `SELECT id, mission_id, description, sort_order
     FROM mission_tasks WHERE mission_id = $1 ORDER BY sort_order ASC`,
    [missionId]
  );
  if (tasks.length === 0) return [];

  const videos = await query<MissionTaskVideo>(
    `SELECT v.id, v.mission_task_id, v.title, v.description, v.video_url, v.thumbnail_url,
            v.duration_seconds, v.provider, v.video_type, v.active
     FROM mission_task_videos v
     JOIN mission_tasks t ON t.id = v.mission_task_id
     WHERE t.mission_id = $1`,
    [missionId]
  );
  const videoByTask = new Map(videos.map((v) => [v.mission_task_id, v]));

  return tasks.map((task) => ({ ...task, video: videoByTask.get(task.id) ?? null }));
}

export interface UpsertMissionTaskVideoInput {
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  provider?: VideoProvider;
  videoType?: VideoType;
  active?: boolean;
}

/**
 * Cria ou substitui o vídeo de uma etapa — só existe um vídeo por etapa por
 * vez nesta fase (item 8 do aditivo fala em "trocar vídeo", não em
 * acumular vários), garantido pelo UNIQUE em `mission_task_id`.
 */
export async function upsertMissionTaskVideo(
  missionTaskId: string,
  input: UpsertMissionTaskVideoInput
): Promise<MissionTaskVideo> {
  const video = await queryOne<MissionTaskVideo>(
    `INSERT INTO mission_task_videos
       (mission_task_id, title, description, video_url, thumbnail_url, duration_seconds, provider, video_type, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (mission_task_id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       video_url = EXCLUDED.video_url,
       thumbnail_url = EXCLUDED.thumbnail_url,
       duration_seconds = EXCLUDED.duration_seconds,
       provider = EXCLUDED.provider,
       video_type = EXCLUDED.video_type,
       active = EXCLUDED.active
     RETURNING ${VIDEO_COLUMNS}`,
    [
      missionTaskId,
      input.title,
      input.description ?? null,
      input.videoUrl,
      input.thumbnailUrl ?? null,
      input.durationSeconds ?? null,
      input.provider ?? "YOUTUBE",
      input.videoType ?? "DEMONSTRATIVO",
      input.active ?? true,
    ]
  );
  if (!video) throw new Error("Não foi possível salvar o vídeo.");
  return video;
}

export async function deleteMissionTaskVideo(missionTaskId: string): Promise<void> {
  await query(`DELETE FROM mission_task_videos WHERE mission_task_id = $1`, [missionTaskId]);
}

/**
 * Monta a árvore trilha -> módulo -> missão com o status de tentativa do aluno.
 * Cria tentativas "disponivel" sob demanda para missões que o aluno ainda não viu.
 */
export async function getStudentProgress(studentId: string): Promise<TrackWithModules[]> {
  const tracks = await query<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
    active: boolean;
  }>(`SELECT id, name, slug, description, sort_order, active FROM tracks WHERE active ORDER BY sort_order ASC`);

  const result: TrackWithModules[] = [];

  for (const track of tracks) {
    const modules = await query<{
      id: string;
      track_id: string;
      name: string;
      description: string | null;
      sort_order: number;
      active: boolean;
    }>(
      `SELECT id, track_id, name, description, sort_order, active
       FROM modules WHERE track_id = $1 AND active ORDER BY sort_order ASC`,
      [track.id]
    );

    const modulesWithMissions = [];
    let trackTotal = 0;
    let trackDone = 0;

    for (const mod of modules) {
      const missions = await query<
        Mission & {
          status: MissionAttemptStatus;
          competencies: string[];
          submission_url: string | null;
        }
      >(
        `SELECT m.id, m.module_id, m.title, m.context, m.objective, m.level,
                m.points_value, m.estimated_minutes, m.sort_order, m.active, m.resource_url,
                m.work_config,
                COALESCE(ma.status, 'disponivel') AS status,
                ma.submission_url,
                COALESCE(
                  (SELECT array_agg(c.name ORDER BY c.name)
                   FROM mission_competencies mc
                   JOIN competencies c ON c.id = mc.competency_id
                   WHERE mc.mission_id = m.id),
                  ARRAY[]::text[]
                ) AS competencies
         FROM missions m
         LEFT JOIN mission_attempts ma ON ma.mission_id = m.id AND ma.student_id = $1
         WHERE m.module_id = $2 AND m.active
         ORDER BY m.sort_order ASC`,
        [studentId, mod.id]
      );

      // Etapas + vídeo de cada missão (Fase 10.2) — uma consulta por missão,
      // no mesmo estilo (não otimizado, mas consistente) já usado no resto
      // desta função para montar trilha -> módulo -> missão.
      const missionsWithTasks = await Promise.all(
        missions.map(async (mission) => ({
          ...mission,
          tasks: await listMissionTasksWithVideo(mission.id),
        }))
      );

      const total = missionsWithTasks.length;
      const done = missionsWithTasks.filter((m) => m.status === "concluida").length;
      trackTotal += total;
      trackDone += done;

      modulesWithMissions.push({
        ...mod,
        missions: missionsWithTasks,
        progress_percent: total === 0 ? 0 : Math.round((done / total) * 100),
      });
    }

    result.push({
      ...track,
      modules: modulesWithMissions,
      progress_percent:
        trackTotal === 0 ? 0 : Math.round((trackDone / trackTotal) * 100),
    });
  }

  return result;
}

export async function startMissionAttempt(studentId: string, missionId: string) {
  await queryOne(
    `INSERT INTO mission_attempts (student_id, mission_id, status, started_at)
     VALUES ($1, $2, 'em_andamento', now())
     ON CONFLICT (student_id, mission_id)
     DO UPDATE SET status = 'em_andamento', started_at = COALESCE(mission_attempts.started_at, now())
     RETURNING id`,
    [studentId, missionId]
  );
}

/**
 * Marca a missão como concluída, credita os pontos ao aluno e atualiza
 * as competências associadas. Tudo em uma única transação.
 */
export async function completeMissionAttempt(
  studentId: string,
  missionId: string,
  submissionUrl?: string
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ status: string }>(
      `SELECT status FROM mission_attempts WHERE student_id = $1 AND mission_id = $2`,
      [studentId, missionId]
    );
    if (existing.rows[0]?.status === "concluida") {
      // Já concluída anteriormente: não credita pontos novamente.
      await client.query("COMMIT");
      return;
    }

    const missionResult = await client.query<{ points_value: number; title: string }>(
      `SELECT points_value, title FROM missions WHERE id = $1`,
      [missionId]
    );
    const mission = missionResult.rows[0];
    if (!mission) throw new Error("Missão não encontrada.");

    await client.query(
      `INSERT INTO mission_attempts (student_id, mission_id, status, score, started_at, completed_at, submission_url)
       VALUES ($1, $2, 'concluida', $3, now(), now(), $4)
       ON CONFLICT (student_id, mission_id)
       DO UPDATE SET status = 'concluida', score = $3,
                      started_at = COALESCE(mission_attempts.started_at, now()),
                      completed_at = now(),
                      submission_url = COALESCE($4, mission_attempts.submission_url)`,
      [studentId, missionId, mission.points_value, submissionUrl ?? null]
    );

    await client.query(
      `UPDATE students SET points = points + $1::int WHERE id = $2::uuid`,
      [mission.points_value, studentId]
    );

    // Recalcula o nível do aluno com base na pontuação acumulada (item 22 do CLAUDE.md)
    await client.query(
      `UPDATE students SET level = CASE
         WHEN points >= 1000 THEN 5
         WHEN points >= 600 THEN 4
         WHEN points >= 300 THEN 3
         WHEN points >= 100 THEN 2
         ELSE 1
       END
       WHERE id = $1`,
      [studentId]
    );

    await client.query(
      `INSERT INTO scores (student_id, points, reason) VALUES ($1, $2, $3)`,
      [studentId, mission.points_value, `Missão concluída: ${mission.title}`]
    );

    const competencyRows = await client.query<{ competency_id: string }>(
      `SELECT competency_id FROM mission_competencies WHERE mission_id = $1`,
      [missionId]
    );
    for (const row of competencyRows.rows) {
      await client.query(
        `INSERT INTO student_competencies (student_id, competency_id, score)
         VALUES ($1, $2, 10)
         ON CONFLICT (student_id, competency_id)
         DO UPDATE SET score = student_competencies.score + 10, updated_at = now()`,
        [studentId, row.competency_id]
      );
    }

    // Concede conquistas (item 24 do CLAUDE.md) com base nos critérios atingidos.
    await client.query(
      `INSERT INTO student_achievements (student_id, achievement_id)
       SELECT $1::uuid, a.id FROM achievements a
       LEFT JOIN student_achievements sa ON sa.student_id = $1::uuid AND sa.achievement_id = a.id
       WHERE a.criteria_type = 'missions_completed'
         AND sa.achievement_id IS NULL
         AND (SELECT COUNT(*) FROM mission_attempts WHERE student_id = $1::uuid AND status = 'concluida') >= a.criteria_value
       ON CONFLICT DO NOTHING`,
      [studentId]
    );
    await client.query(
      `INSERT INTO student_achievements (student_id, achievement_id)
       SELECT $1::uuid, a.id FROM achievements a
       LEFT JOIN student_achievements sa ON sa.student_id = $1::uuid AND sa.achievement_id = a.id
       WHERE a.criteria_type = 'points'
         AND sa.achievement_id IS NULL
         AND (SELECT points FROM students WHERE id = $1::uuid) >= a.criteria_value
       ON CONFLICT DO NOTHING`,
      [studentId]
    );
    await client.query(
      `INSERT INTO student_achievements (student_id, achievement_id)
       SELECT $1::uuid, a.id
       FROM achievements a
       JOIN (
         SELECT mo.track_id,
                COUNT(DISTINCT mi.id) AS total_missions,
                COUNT(DISTINCT CASE WHEN ma.student_id = $1::uuid AND ma.status = 'concluida' THEN ma.mission_id END) AS completed_missions
         FROM modules mo
         JOIN missions mi ON mi.module_id = mo.id AND mi.active
         LEFT JOIN mission_attempts ma ON ma.mission_id = mi.id
         GROUP BY mo.track_id
       ) tp ON tp.track_id = a.criteria_track_id
       LEFT JOIN student_achievements sa ON sa.student_id = $1::uuid AND sa.achievement_id = a.id
       WHERE a.criteria_type = 'track_completed'
         AND sa.achievement_id IS NULL
         AND tp.total_missions > 0
         AND tp.total_missions = tp.completed_missions
       ON CONFLICT DO NOTHING`,
      [studentId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
