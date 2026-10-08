import { query } from "@/lib/db";
import type { UserRole } from "@/types";
import { kidsLevel, type KidsLevelInfo } from "@/lib/levels";
import type { LabSkill } from "@/lib/lab/activities";
import {
  FINAL_LESSON,
  LAB_TRACK_SLUG,
  buildSkillProgress,
  type SkillProgress,
} from "@/modules/lab/queries";

export interface Actor {
  userId: string;
  role: UserRole;
}

export interface MonitorStudent {
  id: string;
  name: string;
  className: string | null;
  schoolName: string;
  points: number;
  level: KidsLevelInfo;
  lessonsDone: number;
  lessonsTotal: number;
  currentLesson: number | null;
  skills: SkillProgress[];
  lastActivityAt: string | null;
  /** Motivos (texto curto) pelos quais o professor deve olhar este aluno. */
  needsHelp: string[];
  finalProject: "not_started" | "in_progress" | "done";
  hasCertificate: boolean;
}

/** Dias sem atividade para sinalizar que o aluno parou. */
export const INACTIVE_DAYS = 7;
/** Tentativas erradas numa mesma atividade para sinalizar dificuldade. */
export const STRUGGLE_ATTEMPTS = 3;

/**
 * Alunos do programa que ESTE usuário pode ver — o isolamento é feito aqui,
 * no SQL, nunca na tela:
 *  - admin: todos;
 *  - coordenador: alunos da sua escola;
 *  - professor: alunos matriculados nas SUAS turmas;
 *  - demais perfis (aluno, etc.): ninguém.
 */
export async function listVisibleLabStudents(
  actor: Actor,
  filter: { classId?: string } = {}
): Promise<{ id: string; name: string; school_name: string; points: number; class_name: string | null }[]> {
  const params: unknown[] = [];
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
    if (actor.role === "admin" || actor.role === "coordinator") {
      classJoin = "JOIN enrollments e ON e.student_id = s.id AND e.status = 'active' JOIN classes cl ON cl.id = e.class_id";
    }
  }

  const rows = await query<{
    id: string;
    name: string;
    school_name: string;
    points: number;
    class_name: string | null;
  }>(
    `SELECT s.id, u.name, sc.name AS school_name, s.points, cl.name AS class_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN schools sc ON sc.id = s.school_id
     ${classJoin}
     WHERE s.audience = 'kids' ${scope}
     ORDER BY u.name ASC`,
    params
  );

  // Aluno em mais de uma turma aparece uma vez.
  const seen = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()];
}

/** O usuário pode ver os dados deste aluno do programa? (checagem para rotas de detalhe) */
export async function canActorSeeLabStudent(actor: Actor, studentId: string): Promise<boolean> {
  const visible = await listVisibleLabStudents(actor);
  return visible.some((s) => s.id === studentId);
}

function placeholders(start: number, n: number) {
  return Array.from({ length: n }, (_, i) => `$${start + i}::uuid`).join(", ");
}

/**
 * Painel do professor/escola: progresso, habilidades (🟢🟡🔴), última atividade
 * e quem precisa de ajuda. Atualizado por polling (não há tempo real no projeto).
 */
export async function getLabMonitor(
  actor: Actor,
  filter: { classId?: string } = {}
): Promise<{ students: MonitorStudent[]; generatedAt: string; summary: MonitorSummary }> {
  const visible = await listVisibleLabStudents(actor, filter);
  const generatedAt = new Date().toISOString();
  if (visible.length === 0) {
    return { students: [], generatedAt, summary: summarize([]) };
  }

  const track = await query<{ id: string }>(
    `SELECT id FROM tracks WHERE slug = $1 AND audience = 'kids'`,
    [LAB_TRACK_SLUG]
  );
  if (!track[0]) return { students: [], generatedAt, summary: summarize([]) };
  const trackId = track[0].id;
  const ids = visible.map((v) => v.id);
  const inList = placeholders(2, ids.length);

  const [lessonCounts, lessonsDoneRows, finalRows, skillCounts, skillRows, struggleRows, lastRows, certRows] =
    await Promise.all([
      query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM missions m JOIN modules mo ON mo.id = m.module_id
         WHERE mo.track_id = $1::uuid AND m.active`,
        [trackId]
      ),
      query<{ student_id: string; n: string; max_n: string }>(
        `SELECT ma.student_id, COUNT(*) AS n, MAX(m.sort_order) AS max_n
         FROM mission_attempts ma
         JOIN missions m ON m.id = ma.mission_id
         JOIN modules mo ON mo.id = m.module_id
         WHERE mo.track_id = $1::uuid AND ma.status = 'concluida' AND ma.student_id IN (${inList})
         GROUP BY ma.student_id`,
        [trackId, ...ids]
      ),
      query<{ student_id: string; status: string }>(
        `SELECT ma.student_id, ma.status
         FROM mission_attempts ma
         JOIN missions m ON m.id = ma.mission_id
         JOIN modules mo ON mo.id = m.module_id
         WHERE mo.track_id = $1::uuid AND m.sort_order = ${FINAL_LESSON} AND ma.student_id IN (${inList})`,
        [trackId, ...ids]
      ),
      query<{ skill: LabSkill; lesson: number; total: number }>(
        `SELECT a.skill, m.sort_order AS lesson, COUNT(*)::int AS total
         FROM mission_activities a
         JOIN missions m ON m.id = a.mission_id
         JOIN modules mo ON mo.id = m.module_id
         WHERE mo.track_id = $1::uuid AND a.active AND m.active
         GROUP BY a.skill, m.sort_order`,
        [trackId]
      ),
      query<{ student_id: string; skill: LabSkill; attempted: number; done: number }>(
        `SELECT p.student_id, a.skill, COUNT(*)::int AS attempted,
                COALESCE(SUM(CASE WHEN p.completed THEN 1 ELSE 0 END), 0)::int AS done
         FROM student_activity_progress p
         JOIN mission_activities a ON a.id = p.activity_id
         JOIN missions m ON m.id = a.mission_id
         JOIN modules mo ON mo.id = m.module_id
         WHERE mo.track_id = $1::uuid AND a.active AND p.student_id IN (${inList})
         GROUP BY p.student_id, a.skill`,
        [trackId, ...ids]
      ),
      query<{ student_id: string; title: string; attempts: number }>(
        `SELECT p.student_id, a.title, p.attempts
         FROM student_activity_progress p
         JOIN mission_activities a ON a.id = p.activity_id
         JOIN missions m ON m.id = a.mission_id
         JOIN modules mo ON mo.id = m.module_id
         WHERE mo.track_id = $1::uuid AND p.completed = false AND p.attempts >= ${STRUGGLE_ATTEMPTS}
           AND p.student_id IN (${inList})
         ORDER BY p.attempts DESC`,
        [trackId, ...ids]
      ),
      query<{ student_id: string; last: string }>(
        `SELECT p.student_id, MAX(p.last_attempt_at) AS last
         FROM student_activity_progress p
         WHERE p.student_id IN (${placeholders(1, ids.length)}) GROUP BY p.student_id`,
        ids
      ),
      query<{ student_id: string }>(
        `SELECT student_id FROM track_certificates WHERE track_id = $1::uuid AND student_id IN (${inList})`,
        [trackId, ...ids]
      ),
    ]);

  const lessonsTotal = Number(lessonCounts[0]?.n ?? 0);
  const now = Date.now();

  const students: MonitorStudent[] = visible.map((v) => {
    const done = lessonsDoneRows.find((r) => r.student_id === v.id);
    const lessonsDone = Number(done?.n ?? 0);
    const finished = lessonsTotal > 0 && lessonsDone >= lessonsTotal;
    const currentLesson = finished ? null : lessonsDone + 1;
    const lastRow = lastRows.find((r) => r.student_id === v.id);
    const last = lastRow ? new Date(lastRow.last).toISOString() : null;

    const skills = buildSkillProgress(
      skillCounts.map((c) => ({ skill: c.skill, lesson: Number(c.lesson), total: Number(c.total) })),
      skillRows
        .filter((r) => r.student_id === v.id)
        .map((r) => ({ skill: r.skill, attempted: Number(r.attempted), done: Number(r.done) })),
      currentLesson ?? lessonsTotal
    );

    const needsHelp: string[] = [];
    const struggles = struggleRows.filter((r) => r.student_id === v.id);
    if (struggles.length > 0) {
      needsHelp.push(`Muitas tentativas em "${struggles[0].title}" (${struggles[0].attempts}x)`);
    }
    for (const s of skills) {
      if (s.status === "needs_practice") needsHelp.push(`Precisa praticar: ${s.skill}`);
    }
    if (!finished && last && now - new Date(last).getTime() > INACTIVE_DAYS * 86400000) {
      needsHelp.push(`Sem atividade há mais de ${INACTIVE_DAYS} dias`);
    }

    const finalStatus = finalRows.find((r) => r.student_id === v.id)?.status;
    return {
      id: v.id,
      name: v.name,
      className: v.class_name,
      schoolName: v.school_name,
      points: Number(v.points),
      level: kidsLevel(Number(v.points)),
      lessonsDone,
      lessonsTotal,
      currentLesson,
      skills,
      lastActivityAt: last,
      needsHelp,
      finalProject: finalStatus === "concluida" ? "done" : finalStatus === "em_andamento" ? "in_progress" : "not_started",
      hasCertificate: certRows.some((r) => r.student_id === v.id),
    };
  });

  return { students, generatedAt, summary: summarize(students) };
}

export interface MonitorSummary {
  students: number;
  averageProgress: number;
  needingHelp: number;
  finished: number;
  /** Habilidade com mais alunos "precisa praticar" (pontos de dificuldade da turma). */
  hardestSkill: { skill: string; count: number } | null;
}

export function summarize(students: MonitorStudent[]): MonitorSummary {
  const total = students.length;
  const averageProgress =
    total === 0
      ? 0
      : Math.round(
          (students.reduce((s, st) => s + (st.lessonsTotal ? st.lessonsDone / st.lessonsTotal : 0), 0) / total) * 100
        );
  const counts = new Map<string, number>();
  for (const st of students)
    for (const sk of st.skills) if (sk.status === "needs_practice") counts.set(sk.skill, (counts.get(sk.skill) ?? 0) + 1);
  const hardest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    students: total,
    averageProgress,
    needingHelp: students.filter((s) => s.needsHelp.length > 0).length,
    finished: students.filter((s) => s.hasCertificate || (s.lessonsTotal > 0 && s.lessonsDone >= s.lessonsTotal)).length,
    hardestSkill: hardest ? { skill: hardest[0], count: hardest[1] } : null,
  };
}
