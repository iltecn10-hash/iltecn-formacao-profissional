import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { GameError, getGameDetail } from "@/modules/games/queries";
import { ResultsError, getGameResults, listActorClasses } from "@/modules/games/results";
import { GamePlayer } from "@/components/games/game-player";
import { GameResultsView } from "@/components/games/game-results-view";

export default async function JogoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ classId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  if (session.role === "student") {
    const studentId = await getStudentIdByUserId(session.userId);
    if (!studentId) redirect("/dashboard");
    const game = await getGameDetail(studentId, id).catch((err) => {
      if (err instanceof GameError) return null;
      throw err;
    });
    if (!game) notFound();
    return <GamePlayer game={game} />;
  }

  const { classId } = await searchParams;
  const actor = { userId: session.userId, role: session.role };
  const safeClass = classId && /^[0-9a-f-]{36}$/i.test(classId) ? classId : undefined;
  const data = await Promise.all([getGameResults(actor, id, { classId: safeClass }), listActorClasses(actor)]).catch((err) => {
    if (err instanceof ResultsError) return null;
    throw err;
  });
  if (!data) notFound();
  const [results, classes] = data;
  return (
    <div className="space-y-4">
      <Link href="/dashboard/jogos" className="text-sm font-semibold text-primary underline">← Todos os jogos</Link>
      <GameResultsView results={results} classes={classes} classId={safeClass ?? ""} />
    </div>
  );
}
