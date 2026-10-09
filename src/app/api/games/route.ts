import { NextResponse } from "next/server";
import { gameErrorResponse, requireRole, requireStudent } from "@/lib/games-api";
import { listGamesForStudent } from "@/modules/games/queries";
import { listGamesForStaff } from "@/modules/games/results";

/** Aluno: jogos liberados para ele. Equipe: jogos que pode acompanhar. */
export async function GET() {
  const staff = await requireRole(["admin", "teacher", "coordinator"]);
  if (!("error" in staff)) {
    return NextResponse.json({ games: await listGamesForStaff({ userId: staff.session.userId, role: staff.session.role }) });
  }
  const auth = await requireStudent();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ games: await listGamesForStudent(auth.studentId) });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
