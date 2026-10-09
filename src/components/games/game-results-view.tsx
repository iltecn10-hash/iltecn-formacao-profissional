import type { GameResults, StudentGameStatus } from "@/modules/games/results";
import { chip, softBtn } from "@/components/lab/ui";

const STATUS: Record<StudentGameStatus, string> = {
  not_started: "Não iniciou",
  in_progress: "Em andamento",
  failed: "Ainda não passou",
  completed: "Concluiu",
};

/** Painel do professor/coordenador/admin: números por aluno, habilidades e desafios difíceis. */
export function GameResultsView({
  results,
  classes,
  classId,
}: {
  results: GameResults;
  classes: { id: string; name: string }[];
  classId: string;
}) {
  const { totals } = results;
  const cards: [string, string | number][] = [
    ["Alunos", totals.students],
    ["Iniciaram", totals.started],
    ["Em andamento", totals.inProgress],
    ["Concluíram", totals.completed],
    ["Precisam de apoio", totals.needSupport],
    ["Média da melhor nota", totals.avgBestPercent === null ? "—" : `${totals.avgBestPercent}%`],
    ["Média de tentativas", totals.avgAttempts === null ? "—" : totals.avgAttempts],
  ];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Resultados: {results.game.title}</h1>
          <p className="text-sm text-muted">
            Aprovação com {results.game.passPercent}% · {results.game.status === "published" ? "Publicado" : "Rascunho"}
          </p>
        </div>
        {classes.length > 0 && (
          <form method="get" className="flex items-end gap-2">
            <label className="text-sm font-semibold">
              Turma
              <select name="classId" defaultValue={classId} className="mt-1 block min-h-11 rounded-xl border-2 border-border bg-surface px-3">
                <option value="">Todas</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <button type="submit" className={softBtn}>Filtrar</button>
          </form>
        )}
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo">
        {cards.map(([label, value]) => (
          <li key={label} className="rounded-2xl border-2 border-border bg-surface p-4">
            <p className="text-2xl font-bold text-primary">{value}</p>
            <p className="text-sm text-muted">{label}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="hab" className="rounded-2xl border-2 border-border bg-surface p-4">
          <h2 id="hab" className="font-heading text-lg font-bold">Habilidades (média da turma)</h2>
          {results.skills.length === 0 ? <p className="mt-2 text-sm text-muted">Ainda sem partidas terminadas.</p> : (
            <ul className="mt-3 space-y-2">
              {results.skills.map((s) => (
                <li key={s.skill}>
                  <div className="flex justify-between text-sm font-semibold"><span>{s.emoji} {s.label}</span><span>{s.avgPercent}%</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-border" aria-hidden><div className="h-full bg-primary" style={{ width: `${s.avgPercent}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="dif" className="rounded-2xl border-2 border-border bg-surface p-4">
          <h2 id="dif" className="font-heading text-lg font-bold">Desafios com mais erros</h2>
          {results.hardest.length === 0 ? <p className="mt-2 text-sm text-muted">Nenhum erro registrado ainda.</p> : (
            <ol className="mt-3 space-y-2 text-sm">
              {results.hardest.map((h) => (
                <li key={h.challengeId}>
                  <strong>{h.title}</strong> <span className="text-muted">({h.phaseTitle} · {h.skillLabel})</span>
                  <br />{h.wrongRate}% das tentativas erradas · {h.students} aluno(s) erraram
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="alunos" className="overflow-x-auto rounded-2xl border-2 border-border bg-surface">
        <h2 id="alunos" className="sr-only">Alunos</h2>
        <table className="w-full text-left text-sm">
          <thead className="bg-primary-light text-primary-dark">
            <tr>
              <th scope="col" className="px-3 py-2">Aluno</th>
              <th scope="col" className="px-3 py-2">Turma</th>
              <th scope="col" className="px-3 py-2">Situação</th>
              <th scope="col" className="px-3 py-2">Tentativas</th>
              <th scope="col" className="px-3 py-2">Melhor</th>
              <th scope="col" className="px-3 py-2">Evolução</th>
              <th scope="col" className="px-3 py-2">Pontos fracos</th>
              <th scope="col" className="px-3 py-2">Apoio</th>
            </tr>
          </thead>
          <tbody>
            {results.students.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-muted">Nenhum aluno encontrado no seu escopo.</td></tr>}
            {results.students.map((s) => {
              const weak = s.skills.filter((k) => k.percent < 70).map((k) => `${k.emoji} ${k.label} (${k.percent}%)`).join(", ");
              return (
                <tr key={s.id} className="border-t border-border align-top">
                  <th scope="row" className="px-3 py-2 font-semibold">{s.name}</th>
                  <td className="px-3 py-2">{s.className ?? "—"}</td>
                  <td className="px-3 py-2"><span className={chip}>{STATUS[s.status]}</span></td>
                  <td className="px-3 py-2">{s.attempts}</td>
                  <td className="px-3 py-2">{s.attempts > 0 ? `${s.bestPercent}%` : "—"}</td>
                  <td className="px-3 py-2">{s.evolution.length ? s.evolution.map((p) => `${p}%`).join(" → ") : "—"}</td>
                  <td className="px-3 py-2">{weak || "—"}</td>
                  <td className="px-3 py-2">{s.needsSupport ? <strong className="text-danger">⚠ {s.needsSupport}</strong> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
