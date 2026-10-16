import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadPageContext, type ContextParams } from "@/modules/council/context";
import { listAssignments } from "@/modules/council/queries";
import { getPanel, getSheet } from "@/modules/council/evaluations";
import { ContextBar, ctxQuery } from "@/components/conselho/context-bar";

export default async function ConselhoPage({ searchParams }: { searchParams: Promise<ContextParams> }) {
  const session = await getSession();
  if (!session || session.role === "student") redirect("/dashboard");
  const actor = { userId: session.userId, role: session.role };
  const ctx = await loadPageContext(actor, await searchParams);
  const manager = session.role !== "teacher";

  if (!ctx)
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Conselho de Classe</h1>
        <p className="mt-4 card p-6 text-sm text-muted">
          Seu cadastro ainda não está ligado a uma escola. Peça ao administrador para concluir o cadastro.
        </p>
      </div>
    );

  const qs = ctxQuery(ctx);
  const mine = session.role === "teacher"
    ? (await listAssignments(actor)).filter((a) => a.school_year === ctx.year) : [];
  const sheets = ctx.period
    ? await Promise.all(mine.map((a) => getSheet(actor, a.id, ctx.period!.id))) : [];
  const panel = manager && ctx.period ? await getPanel(actor, ctx.schoolId, ctx.period.id) : null;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Conselho de Classe</h1>
      <p className="mt-1 text-muted">
        Avaliação do desempenho dos alunos por turma, disciplina e bimestre. É um apoio pedagógico:
        não gera nota oficial nem decide aprovação.
      </p>
      <ContextBar ctx={ctx} />
      {ctx.period?.status === "closed" && (
        <p className="mt-4 rounded-md bg-accent/15 px-4 py-3 text-sm text-foreground">
          Este bimestre está encerrado: as avaliações só podem ser consultadas.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {manager && (
          <>
            <Link href={`/dashboard/conselho/painel?${qs}`} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">Painel da coordenação</Link>
            <Link href={`/dashboard/conselho/relatorio?${qs}`} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-background">Relatórios</Link>
          </>
        )}
        <Link href={`/dashboard/conselho/configuracao?${qs}`} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-background">
          {manager ? "Configuração (disciplinas, bimestres, critérios, vínculos)" : "Disciplinas"}
        </Link>
      </div>

      {panel && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Vínculos", panel.totals.assignments], ["Concluídos", panel.totals.concluded],
            ["Em andamento", panel.totals.inProgress], ["Não iniciados", panel.totals.notStarted],
          ].map(([l, n]) => (
            <div key={l as string} className="card p-4">
              <p className="text-2xl font-bold text-primary-dark">{n}</p>
              <p className="text-xs text-muted">{l}</p>
            </div>
          ))}
        </div>
      )}

      {session.role === "teacher" && (
        <div className="mt-8">
          <h2 className="font-heading text-lg font-semibold text-foreground">Minhas avaliações — {ctx.period?.name}</h2>
          {mine.length === 0 ? (
            <p className="mt-3 card p-6 text-sm text-muted">
              Você ainda não está vinculado a nenhuma turma e disciplina neste ano. A coordenação faz o
              vínculo em Configuração (ou você mesmo, nas turmas pelas quais é responsável).
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {mine.map((a, i) => {
                const s = sheets[i];
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 card p-4">
                    <div>
                      <p className="font-medium text-foreground">{a.class_name} · {a.subject_name}</p>
                      <p className="text-xs text-muted">
                        {s ? `${s.counts.final} de ${s.counts.total} finalizadas · ${s.counts.draft} em rascunho` : "—"}
                      </p>
                    </div>
                    <Link href={`/dashboard/conselho/avaliar/${a.id}?${qs}`} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
                      {s && s.counts.final === s.counts.total && s.counts.total > 0 ? "Ver avaliações" : "Avaliar alunos"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
