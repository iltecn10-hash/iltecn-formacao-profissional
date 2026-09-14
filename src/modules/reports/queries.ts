import { query, queryOne } from "@/lib/db";

export interface StudentReportData {
  student: {
    id: string;
    name: string;
    email: string;
    school_name: string;
    class_name: string | null;
    level: number;
    points: number;
  };
  missionsCompleted: number;
  missionsTotal: number;
  competencies: { name: string; score: number }[];
  strengths: string[];
  improvements: string[];
}

export async function getStudentReport(studentId: string): Promise<StudentReportData | null> {
  const student = await queryOne<{
    id: string;
    name: string;
    email: string;
    school_name: string;
    class_name: string | null;
    level: number;
    points: number;
  }>(
    `SELECT s.id, u.name, u.email, sc.name AS school_name, s.level, s.points,
            (SELECT c.name FROM enrollments e
             JOIN classes c ON c.id = e.class_id
             WHERE e.student_id = s.id AND e.status = 'active'
             ORDER BY e.enrolled_at DESC LIMIT 1) AS class_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN schools sc ON sc.id = s.school_id
     WHERE s.id = $1`,
    [studentId]
  );
  if (!student) return null;

  const missionCounts = await queryOne<{ completed: string; total: string }>(
    `SELECT
       (SELECT COUNT(*) FROM mission_attempts WHERE student_id = $1 AND status = 'concluida') AS completed,
       (SELECT COUNT(*) FROM missions WHERE active) AS total`,
    [studentId]
  );

  const competencies = await query<{ name: string; score: number }>(
    `SELECT c.name, COALESCE(sc.score, 0) AS score
     FROM competencies c
     LEFT JOIN student_competencies sc ON sc.competency_id = c.id AND sc.student_id = $1
     ORDER BY score DESC, c.name ASC`,
    [studentId]
  );

  const withProgress = competencies.filter((c) => c.score > 0);
  const strengths = withProgress.slice(0, 3).map((c) => c.name);
  const improvements = competencies
    .filter((c) => c.score === 0)
    .slice(0, 3)
    .map((c) => c.name);

  return {
    student,
    missionsCompleted: Number(missionCounts?.completed ?? 0),
    missionsTotal: Number(missionCounts?.total ?? 0),
    competencies,
    strengths,
    improvements,
  };
}

export interface StudentPerformanceRow {
  student_id: string;
  name: string;
  class_name: string | null;
  points: number;
  level: number;
  missions_completed: number;
}

export async function listStudentsPerformance(): Promise<StudentPerformanceRow[]> {
  return query<StudentPerformanceRow>(
    `SELECT s.id AS student_id, u.name, s.points, s.level,
            (SELECT c.name FROM enrollments e
             JOIN classes c ON c.id = e.class_id
             WHERE e.student_id = s.id AND e.status = 'active'
             ORDER BY e.enrolled_at DESC LIMIT 1) AS class_name,
            (SELECT COUNT(*) FROM mission_attempts ma
             WHERE ma.student_id = s.id AND ma.status = 'concluida')::int AS missions_completed
     FROM students s
     JOIN users u ON u.id = s.user_id
     ORDER BY u.name ASC`
  );
}

export async function getModulePerformance(): Promise<
  { module_name: string; track_name: string; completion_rate: number }[]
> {
  const totalStudents = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM students`);
  const students = Number(totalStudents?.count ?? 0);
  if (students === 0) return [];

  return query<{ module_name: string; track_name: string; completion_rate: number }>(
    `SELECT m.name AS module_name, t.name AS track_name,
            ROUND(
              COUNT(DISTINCT ma.student_id) FILTER (WHERE ma.status = 'concluida')::numeric
              / NULLIF($1, 0) * 100
            ) AS completion_rate
     FROM modules m
     JOIN tracks t ON t.id = m.track_id
     LEFT JOIN missions mi ON mi.module_id = m.id
     LEFT JOIN mission_attempts ma ON ma.mission_id = mi.id
     GROUP BY m.name, t.name, m.sort_order
     ORDER BY m.sort_order ASC`,
    [students]
  );
}
