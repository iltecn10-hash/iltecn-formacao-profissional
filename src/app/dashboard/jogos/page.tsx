import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { listGamesForStudent } from "@/modules/games/queries";
import { listGamesForStaff } from "@/modules/games/results";
import { DIFFICULTY_LABEL, type GameDifficulty } from "@/lib/games/engine";
import { chip, primaryBtn, softBtn } from "@/components/lab/ui";

const STATE_LABEL = {
  locked: "🔒 Bloqueado",
  available: "Disponível",
  in_progress: "▶ Em andamento",
  completed: "✅ Concluído",
  limit: "Sem tentativas",
} as const;

export default async function JogosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "student") {
    const studentId = await getStudentIdByUserId(session.userId);
    const games = studentId ? await listGamesForStudent(studentId) : [];
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-bold text-foreground">🎮 Jogos</h1>
          <p className="mt-1 text-muted">Pratique o que aprendeu, ganhe estrelas, XP e medalhas.</p>
        </header>
        {games.length === 0 && <p className="text-muted">Nenhum jogo liberado para você ainda.</p>}
        <ul className="grid gap-4 sm:grid-cols-2">
          {games.map((g) => (
            <li key={g.id} className="flex flex-col rounded-3xl border-2 border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl font-bold">{g.title}</h2>
                <span className={chip}>{STATE_LABEL[g.state]}</span>
              </div>
              <p className="mt-2 flex-1 text-base text-muted">{g.description}</p>
              <p className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className={chip}>{g.phases} fases</span>
                <span className={chip}>{DIFFICULTY_LABEL[g.difficulty as GameDifficulty] ?? g.difficulty}</span>
                <span className={chip}>+{g.xpReward} XP</span>
                {g.attempts > 0 && <span className={chip}>Melhor: {g.bestPercent}%</span>}
              </p>
              {g.missionTitle && <p className="mt-2 text-sm text-muted">Ligado à missão: {g.missionTitle}</p>}
              {g.lockReason && <p className="mt-2 text-sm font-semibold">{g.lockReason}</p>}
              <Link href={`/dashboard/jogos/${g.id}`} className={`${primaryBtn} mt-4 inline-flex items-center justify-center`}>
                {g.state === "in_progress" ? "Continuar" : g.attempts > 0 ? "Ver / jogar de novo" : "Jogar"}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const games = await listGamesForStaff({ userId: session.userId, role: session.role });
  const isAdmin = session.role === "admin";
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">🎮 Central de Jogos</h1>
          <p className="mt-1 text-muted">Acompanhe os resultados dos alunos em cada jogo.</p>
        </div>
        {isAdmin && <Link href="/dashboard/jogos/novo" className={`${primaryBtn} inline-flex items-center`}>+ Novo jogo</Link>}
      </header>
      {games.length === 0 && <p className="text-muted">Nenhum jogo publicado ainda.</p>}
      <ul className="space-y-3">
        {games.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-border bg-surface p-4">
            <div>
              <p className="font-heading text-lg font-bold">{g.title}</p>
              <p className="text-sm text-muted">
                {g.status === "published" ? "Publicado" : "Rascunho"} · {DIFFICULTY_LABEL[g.difficulty as GameDifficulty] ?? g.difficulty} · público: {g.audience === "all" ? "todos" : g.audience === "kids" ? "infantil" : "profissional"}
                {g.missionTitle ? ` · missão: ${g.missionTitle}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/dashboard/jogos/${g.id}`} className={`${softBtn} inline-flex items-center`}>Resultados</Link>
              {isAdmin && <Link href={`/dashboard/jogos/${g.id}/editar`} className={`${softBtn} inline-flex items-center`}>Editar</Link>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
