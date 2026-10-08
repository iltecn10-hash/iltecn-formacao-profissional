import { LAB_ACHIEVEMENTS } from "@/lib/lab/content/achievements";
import { LAB_MODULES, LAB_TRACK } from "@/lib/lab/content";

/**
 * Qualquer coisa com `query()` serve: o `PoolClient` real (pg) ou o do pg-mem
 * nos testes — o seed não conhece o banco por baixo.
 */
export interface SeedClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface SeedSummary {
  trackCreated: boolean;
  modulesCreated: number;
  lessonsCreated: number;
  tasksCreated: number;
  activitiesCreated: number;
  achievementsCreated: number;
}

export interface SeedOptions {
  /**
   * `false` (padrão): só cria o que falta e NUNCA sobrescreve o que o
   * administrador já editou (XP, textos, ordem). `true`: atualiza o conteúdo
   * das aulas e atividades existentes com o que está no código.
   */
  overwrite?: boolean;
}

/**
 * Seed idempotente do programa ILTECN LAB. Rodar duas vezes não duplica nada:
 * trilha por `slug`, módulo por (trilha, nome), aula por (módulo, título),
 * atividade e conquista por `code`.
 *
 * A transação fica a cargo de quem chama (o script usa BEGIN/COMMIT; os testes
 * rodam direto).
 */
export async function seedLabProgram(
  db: SeedClient,
  options: SeedOptions = {}
): Promise<SeedSummary> {
  const overwrite = options.overwrite ?? false;
  const summary: SeedSummary = {
    trackCreated: false,
    modulesCreated: 0,
    lessonsCreated: 0,
    tasksCreated: 0,
    activitiesCreated: 0,
    achievementsCreated: 0,
  };

  // 1. Trilha -----------------------------------------------------------------
  const trackDescription = `${LAB_TRACK.subtitle} ${LAB_TRACK.description}`;
  let trackId = (
    await db.query(`SELECT id FROM tracks WHERE slug = $1`, [LAB_TRACK.slug])
  ).rows[0]?.id as string | undefined;

  if (!trackId) {
    const order = await db.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM tracks`);
    const inserted = await db.query(
      `INSERT INTO tracks (name, slug, description, sort_order, audience)
       VALUES ($1, $2, $3, $4, 'kids') RETURNING id`,
      [LAB_TRACK.name, LAB_TRACK.slug, trackDescription, Number(order.rows[0]?.next ?? 1)]
    );
    trackId = inserted.rows[0].id as string;
    summary.trackCreated = true;
  } else if (overwrite) {
    await db.query(`UPDATE tracks SET name = $1, description = $2, audience = 'kids' WHERE id = $3`, [
      LAB_TRACK.name,
      trackDescription,
      trackId,
    ]);
  }

  // 2. Módulos, aulas, etapas e atividades -------------------------------------
  const missionIdByLesson = new Map<number, string>();

  for (let m = 0; m < LAB_MODULES.length; m++) {
    const mod = LAB_MODULES[m];
    let moduleId = (
      await db.query(`SELECT id FROM modules WHERE track_id = $1 AND name = $2`, [trackId, mod.name])
    ).rows[0]?.id as string | undefined;

    if (!moduleId) {
      const inserted = await db.query(
        `INSERT INTO modules (track_id, name, description, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [trackId, mod.name, mod.description, m + 1]
      );
      moduleId = inserted.rows[0].id as string;
      summary.modulesCreated++;
    } else if (overwrite) {
      await db.query(`UPDATE modules SET description = $1, sort_order = $2 WHERE id = $3`, [
        mod.description,
        m + 1,
        moduleId,
      ]);
    }

    for (const lesson of mod.lessons) {
      const workConfig = lesson.document
        ? JSON.stringify({ workType: "DOCUMENT", templateKey: null })
        : null;

      let missionId = (
        await db.query(`SELECT id FROM missions WHERE module_id = $1 AND title = $2`, [
          moduleId,
          lesson.title,
        ])
      ).rows[0]?.id as string | undefined;

      if (!missionId) {
        const inserted = await db.query(
          `INSERT INTO missions
             (module_id, title, context, objective, level, points_value,
              estimated_minutes, sort_order, work_config)
           VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8::jsonb) RETURNING id`,
          [
            moduleId,
            lesson.title,
            lesson.context,
            lesson.objective,
            lesson.points,
            lesson.estimatedMinutes,
            lesson.number,
            workConfig,
          ]
        );
        missionId = inserted.rows[0].id as string;
        summary.lessonsCreated++;

        // Passo a passo da aula — só na criação, para não apagar (em cascata)
        // os vídeos por etapa que o administrador possa ter anexado depois.
        for (let i = 0; i < lesson.steps.length; i++) {
          await db.query(
            `INSERT INTO mission_tasks (mission_id, description, sort_order) VALUES ($1, $2, $3)`,
            [missionId, lesson.steps[i], i + 1]
          );
          summary.tasksCreated++;
        }
      } else if (overwrite) {
        await db.query(
          `UPDATE missions
             SET context = $1, objective = $2, points_value = $3, estimated_minutes = $4,
                 sort_order = $5, work_config = $6::jsonb
           WHERE id = $7`,
          [
            lesson.context,
            lesson.objective,
            lesson.points,
            lesson.estimatedMinutes,
            lesson.number,
            workConfig,
            missionId,
          ]
        );
      }
      missionIdByLesson.set(lesson.number, missionId);

      for (let i = 0; i < lesson.activities.length; i++) {
        const a = lesson.activities[i];
        const existed =
          (await db.query(`SELECT 1 FROM mission_activities WHERE code = $1`, [a.code])).rows
            .length > 0;
        if (existed && !overwrite) continue;

        await db.query(
          `INSERT INTO mission_activities
             (code, mission_id, sort_order, kind, category, skill, title, prompt, config, xp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
           ON CONFLICT (code) DO UPDATE SET
             kind = EXCLUDED.kind, category = EXCLUDED.category, skill = EXCLUDED.skill,
             title = EXCLUDED.title, prompt = EXCLUDED.prompt, config = EXCLUDED.config,
             xp = EXCLUDED.xp, sort_order = EXCLUDED.sort_order`,
          [
            a.code,
            missionId,
            i + 1,
            a.kind,
            a.category,
            a.skill,
            a.title,
            a.prompt,
            JSON.stringify(a.config),
            a.xp,
          ]
        );
        if (!existed) summary.activitiesCreated++;
      }
    }
  }

  // 3. Conquistas ---------------------------------------------------------------
  for (const ach of LAB_ACHIEVEMENTS) {
    const c = ach.criteria;
    const missionId =
      c.type === "mission_completed"
        ? missionIdByLesson.get(c.lesson) ?? null
        : c.type === "skill_completed"
          ? missionIdByLesson.get(c.uptoLesson) ?? null
          : null;
    const useTrack =
      c.type === "track_started" || c.type === "challenges_completed" || c.type === "track_completed";

    const existed =
      (await db.query(`SELECT 1 FROM achievements WHERE code = $1`, [ach.code])).rows.length > 0;
    if (existed && !overwrite) continue;

    await db.query(
      `INSERT INTO achievements
         (code, name, description, icon, criteria_type, criteria_value,
          criteria_track_id, criteria_mission_id, criteria_skill, audience)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, 'kids')
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon,
         criteria_type = EXCLUDED.criteria_type, criteria_track_id = EXCLUDED.criteria_track_id,
         criteria_mission_id = EXCLUDED.criteria_mission_id,
         criteria_skill = EXCLUDED.criteria_skill, audience = 'kids'`,
      [
        ach.code,
        ach.name,
        ach.description,
        ach.icon,
        c.type,
        useTrack ? trackId : null,
        missionId,
        c.type === "skill_completed" ? c.skill : null,
      ]
    );
    if (!existed) summary.achievementsCreated++;
  }

  return summary;
}
