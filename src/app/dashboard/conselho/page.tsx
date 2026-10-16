import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadPageContext, type ContextParams } from "@/modules/council/context";
import { listAssignments } from "@/modules/council/queries";
import { getPanel, getSheet } from "@/modules/council/evaluations";
import { ContextBar, ctxQuery } from "@/components/conselho/context-bar";
import { StatCard } from "@/components/stat-card";
import { NavIcon } from "@/components/nav-icons";

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

  // Indicadores: coordenação/admin vêm do painel; professor soma as suas folhas (dados reais do bimestre).
  const mineTotals = sheets.reduce(
    (t, sh) => ({
      assignments: t.assignments + 1,
      final: t.final + (sh?.counts.final ?? 0),
      draft: t.draft + (sh?.counts.draft ?? 0),
      total: t.total + (sh?.counts.total ?? 0),
    }),
    { assignments: 0, final: 0, draft: 0, total: 0 },
  );
  const pendingMine = mineTotals.total - mineTotals.final;

  return (
    <div>
      <div className="card flex items-start gap-4 bg-gradient-to-r from-primary-light to-surface p-6">
        <span aria-hidden className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white sm:flex">
          <NavIcon name="clipboard" className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Conselho de Classe</p>
          <h1 className="font-heading text-2xl font-bold text-foreground">Avaliação do Desempenho dos Alunos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Avaliação por turma, disciplina e bimestre. É um apoio pedagógico: não gera nota oficial nem decide aprovação.
          </p>
        </div>
      </div>

      <ContextBar ctx={ctx} />
      {ctx.period?.status === "closed" && (
        <p className="mt-4 rounded-lg bg-warning-light px-4 py-3 text-sm font-medium text-warning">
          Este bimestre está encerrado: as avaliações só podem ser consultadas.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {panel ? (
          <>
            <StatCard label="Vínculos" value={panel.totals.assignments} hint="turma × disciplina" />
            <StatCard label="Concluídos" value={panel.totals.concluded} hint="todas as avaliações finalizadas" tone="success" />
            <StatCard label="Em andamento" value={panel.totals.inProgress} hint="com rascunhos" tone="warning" />
            <StatCard label="Não iniciados" value={panel.totals.notStarted} hint="aguardando o professor" tone="warning" />
          </>
        ) : session.role === "teacher" ? (
          <>
            <StatCard label="Minhas turmas/disciplinas" value={mineTotals.assignments} hint="vínculos neste ano" />
            <StatCard label="Alunos avaliados" value={mineTotals.final} hint={`de ${mineTotals.total} avaliações`} tone="success" />
            <StatCard label="Pendentes" value={pendingMine} hint="aguardando avaliação" tone={pendingMine === 0 ? "success" : "warning"} />
            <StatCard label="Em rascunho" value={mineTotals.draft} hint="ainda não finalizadas" />
          </>
        ) : null}
      </div>

      <h2 className="mt-10 font-heading text-lg font-semibold text-foreground">Acesso rápido</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {manager && (
          <>
            <Link href={`/dashboard/conselho/painel?${qs}`} className="card block p-5 transition hover:border-primary hover:shadow-md">
              <p className="font-semibold text-foreground">Acompanhar turmas</p>
              <p className="mt-1 text-sm text-muted">Status do preenchimento de cada turma e disciplina.</p>
            </Link>
            <Link href={`/dashboard/conselho/relatorio?${qs}`} className="card block p-5 transition hover:border-primary hover:shadow-md">
              <p className="font-semibold text-foreground">Relatórios</p>
              <p className="mt-1 text-sm text-muted">Individuais e consolidados, para consulta e impressão.</p>
            </Link>
          </>
        )}
        <Link href={`/dashboard/conselho/configuracao?${qs}`} className="card block p-5 transition hover:border-primary hover:shadow-md">
          <p className="font-semibold text-foreground">{manager ? "Configurações" : "Disciplinas"}</p>
          <p className="mt-1 text-sm text-muted">
            {manager ? "Disciplinas, bimestres, critérios e vínculos." : "Cadastre novas disciplinas, se precisar."}
          </p>
        </Link>
      </div>

      {session.role === "teacher" && (
        <div className="mt-8">
          <h2 id="minhas" className="font-heading text-lg font-semibold text-foreground">Minhas avaliações — {ctx.period?.name}</h2>
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
                    <Link href={`/dashboard/conselho/avaliar/${a.id}?${qs}`} className="btn btn-primary">
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
