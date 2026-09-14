import { query } from "@/lib/db";
import type { Achievement } from "@/types";

export async function listAchievementsForStudent(studentId: string): Promise<Achievement[]> {
  return query<Achievement>(
    `SELECT a.id, a.code, a.name, a.description, a.icon, sa.earned_at
     FROM achievements a
     LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.student_id = $1
     ORDER BY (sa.earned_at IS NULL), sa.earned_at DESC, a.name ASC`,
    [studentId]
  );
}
