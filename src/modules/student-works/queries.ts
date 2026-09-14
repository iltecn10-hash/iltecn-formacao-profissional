import { pool, query, queryOne } from "@/lib/db";
import type { StudentWork, StudentWorkVersion, WorkEvaluation, WorkType } from "@/types";
import { sanitizeJsonValue } from "@/lib/sanitize-json";
import { evaluateStudentWork } from "@/lib/work-evaluation";

const STUDENT_WORK_COLUMNS = `
  id, student_id, mission_id, mission_attempt_id, work_type, title,
  template_key, content, status, version, submitted_at, created_at, updated_at
`;

// Estados em que o trabalho não pode mais ser editado pelo aluno.
const LOCKED_STATUSES = ["SUBMITTED", "APPROVED"] as const;

/**
 * Garante que existe uma tentativa de missão para o aluno (reaproveita a
 * mesma regra de `startMissionAttempt`, sem duplicar a lógica) e retorna o
 * id dessa tentativa.
 */
async function ensureMissionAttemptId(
  studentId: string,
  missionId: string
): Promise<string | null> {
  await queryOne(
    `INSERT INTO mission_attempts (student_id, mission_id, status, started_at)
     VALUES ($1, $2, 'em_andamento', now())
     ON CONFLICT (student_id, mission_id)
     DO UPDATE SET status = CASE
         WHEN mission_attempts.status = 'disponivel' THEN 'em_andamento'
         ELSE mission_attempts.status
       END,
       started_at = COALESCE(mission_attempts.started_at, now())
     RETURNING id`,
    [studentId, missionId]
  );
  const attempt = await queryOne<{ id: string }>(
    `SELECT id FROM mission_attempts WHERE student_id = $1 AND mission_id = $2`,
    [studentId, missionId]
  );
  return attempt?.id ?? null;
}

/**
 * Cria o trabalho do aluno para a missão/tipo indicados, ou retorna o
 * trabalho já existente (um aluno tem no máximo um DOCUMENT e uma
 * SPREADSHEET por missão — ver seção 42 da Fase 9).
 */
export async function getOrCreateStudentWork(
  studentId: string,
  missionId: string,
  workType: WorkType,
  options?: { title?: string; templateKey?: string }
): Promise<StudentWork> {
  const mission = await queryOne<{ id: string; title: string; active: boolean }>(
    `SELECT id, title, active FROM missions WHERE id = $1`,
    [missionId]
  );
  if (!mission || !mission.active) {
    throw new Error("Missão não encontrada ou inativa.");
  }

  const existing = await queryOne<StudentWork>(
    `SELECT ${STUDENT_WORK_COLUMNS} FROM student_works
     WHERE student_id = $1 AND mission_id = $2 AND work_type = $3`,
    [studentId, missionId, workType]
  );
  if (existing) return existing;

  const attemptId = await ensureMissionAttemptId(studentId, missionId);

  const created = await queryOne<StudentWork>(
    `INSERT INTO student_works
       (student_id, mission_id, mission_attempt_id, work_type, title, template_key, content)
     VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)
     ON CONFLICT (student_id, mission_id, work_type) DO NOTHING
     RETURNING ${STUDENT_WORK_COLUMNS}`,
    [
      studentId,
      missionId,
      attemptId,
      workType,
      options?.title ?? mission.title,
      options?.templateKey ?? null,
    ]
  );
  if (created) return created;

  // Corrida rara: outra requisição criou entre o SELECT e o INSERT.
  const raceWinner = await queryOne<StudentWork>(
    `SELECT ${STUDENT_WORK_COLUMNS} FROM student_works
     WHERE student_id = $1 AND mission_id = $2 AND work_type = $3`,
    [studentId, missionId, workType]
  );
  if (!raceWinner) throw new Error("Falha ao criar o trabalho do aluno.");
  return raceWinner;
}

export async function getStudentWorkById(id: string): Promise<StudentWork | null> {
  return queryOne<StudentWork>(
    `SELECT sw.id, sw.student_id, sw.mission_id, sw.mission_attempt_id, sw.work_type,
            sw.title, sw.template_key, sw.content, sw.status, sw.version,
            sw.submitted_at, sw.created_at, sw.updated_at,
            m.title AS mission_title, u.name AS student_name
     FROM student_works sw
     JOIN missions m ON m.id = sw.mission_id
     JOIN students s ON s.id = sw.student_id
     JOIN users u ON u.id = s.user_id
     WHERE sw.id = $1`,
    [id]
  );
}

export async function listStudentWorksByStudent(
  studentId: string
): Promise<StudentWork[]> {
  return query<StudentWork>(
    `SELECT sw.id, sw.student_id, sw.mission_id, sw.mission_attempt_id, sw.work_type,
            sw.title, sw.template_key, sw.content, sw.status, sw.version,
            sw.submitted_at, sw.created_at, sw.updated_at,
            m.title AS mission_title
     FROM student_works sw
     JOIN missions m ON m.id = sw.mission_id
     WHERE sw.student_id = $1
     ORDER BY sw.updated_at DESC`,
    [studentId]
  );
}

export interface StaffWorkFilters {
  studentId?: string;
  missionId?: string;
  status?: string;
}

/** Listagem para professor/admin/coordenador (dashboard "Trabalhos dos Alunos" — Fase 9.6). */
export async function listStudentWorksForStaff(
  filters: StaffWorkFilters
): Promise<StudentWork[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.studentId) {
    params.push(filters.studentId);
    conditions.push(`sw.student_id = $${params.length}`);
  }
  if (filters.missionId) {
    params.push(filters.missionId);
    conditions.push(`sw.mission_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`sw.status = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<StudentWork>(
    `SELECT sw.id, sw.student_id, sw.mission_id, sw.mission_attempt_id, sw.work_type,
            sw.title, sw.template_key, sw.content, sw.status, sw.version,
            sw.submitted_at, sw.created_at, sw.updated_at,
            m.title AS mission_title, u.name AS student_name
     FROM student_works sw
     JOIN missions m ON m.id = sw.mission_id
     JOIN students s ON s.id = sw.student_id
     JOIN users u ON u.id = s.user_id
     ${where}
     ORDER BY sw.updated_at DESC`,
    params
  );
}

export class StudentWorkNotEditableError extends Error {
  constructor() {
    super("Este trabalho já foi entregue e não pode mais ser editado.");
    this.name = "StudentWorkNotEditableError";
  }
}

/**
 * Autosave do conteúdo do editor. Só o próprio aluno pode salvar, e só
 * enquanto o trabalho não estiver SUBMITTED/APPROVED (seção 26: nunca
 * sobrescrever/perder trabalho indevidamente).
 */
export async function saveStudentWorkContent(
  workId: string,
  studentId: string,
  input: { content: Record<string, unknown>; title?: string }
): Promise<StudentWork> {
  const current = await queryOne<{ status: string }>(
    `SELECT status FROM student_works WHERE id = $1 AND student_id = $2`,
    [workId, studentId]
  );
  if (!current) throw new Error("Trabalho não encontrado.");
  if (LOCKED_STATUSES.includes(current.status as (typeof LOCKED_STATUSES)[number])) {
    throw new StudentWorkNotEditableError();
  }

  // Conteúdo vem de fora (autosave do editor) — nunca confiar nele sem
  // sanitizar chaves perigosas (__proto__/constructor/prototype) antes de
  // persistir. Ver GHSA-cp6q-959q-f8rh (mergeAttributes do Tiptap).
  const safeContent = sanitizeJsonValue(input.content);

  const updated = await queryOne<StudentWork>(
    `UPDATE student_works
     SET content = $1::jsonb,
         title = COALESCE($2, title),
         status = CASE WHEN status = 'DRAFT' THEN 'IN_PROGRESS' ELSE status END,
         version = version + 1,
         updated_at = now()
     WHERE id = $3 AND student_id = $4
     RETURNING ${STUDENT_WORK_COLUMNS}`,
    [JSON.stringify(safeContent), input.title ?? null, workId, studentId]
  );
  if (!updated) throw new Error("Não foi possível salvar o trabalho.");
  return updated;
}

/**
 * Entrega o trabalho: preserva uma versão final (seção 3 — versionamento
 * básico) e muda o status para SUBMITTED. Idempotente: entregar de novo um
 * trabalho já entregue apenas retorna o estado atual, sem duplicar versão.
 */
export async function submitStudentWork(
  workId: string,
  studentId: string
): Promise<StudentWork> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await client.query<StudentWork>(
      `SELECT ${STUDENT_WORK_COLUMNS} FROM student_works
       WHERE id = $1 AND student_id = $2 FOR UPDATE`,
      [workId, studentId]
    );
    const work = current.rows[0];
    if (!work) throw new Error("Trabalho não encontrado.");

    if (work.status === "SUBMITTED" || work.status === "APPROVED") {
      await client.query("COMMIT");
      return work;
    }

    await client.query(
      `INSERT INTO student_work_versions (student_work_id, version, content, label)
       VALUES ($1, $2, $3::jsonb, 'Entrega final')
       ON CONFLICT (student_work_id, version) DO NOTHING`,
      [work.id, work.version, JSON.stringify(work.content)]
    );

    const result = await client.query<StudentWork>(
      `UPDATE student_works
       SET status = 'SUBMITTED', submitted_at = now(), updated_at = now()
       WHERE id = $1 AND student_id = $2
       RETURNING ${STUDENT_WORK_COLUMNS}`,
      [workId, studentId]
    );

    // Avaliação automática (Fase 9.5): roda uma única vez, na entrega, sobre
    // o conteúdo que acabou de ser travado — nunca recalculada depois, para
    // não mudar de nota por baixo dos pés do aluno se a régua evoluir.
    const auto = evaluateStudentWork(work.work_type, work.template_key, work.content);
    await client.query(
      `INSERT INTO work_evaluations
         (student_work_id, evaluator_id, evaluation_type, score, passed, feedback, details)
       VALUES ($1, NULL, 'AUTO', $2, $3, $4, $5::jsonb)`,
      [work.id, auto.score, auto.passed, auto.feedback, JSON.stringify(auto.details)]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Avaliações (automática e, a partir da Fase 9.6, manual) de um trabalho. */
export async function listWorkEvaluations(workId: string): Promise<WorkEvaluation[]> {
  return query<WorkEvaluation>(
    `SELECT id, student_work_id, evaluator_id, evaluation_type, score, passed,
            feedback, details, created_at
     FROM work_evaluations
     WHERE student_work_id = $1
     ORDER BY created_at DESC`,
    [workId]
  );
}

export async function listStudentWorkVersions(
  workId: string
): Promise<StudentWorkVersion[]> {
  return query<StudentWorkVersion>(
    `SELECT id, student_work_id, version, content, label, created_at
     FROM student_work_versions
     WHERE student_work_id = $1
     ORDER BY version DESC`,
    [workId]
  );
}
