import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadPageContext, type ContextParams } from "@/modules/council/context";
import { getPanel, type PanelRow } from "@/modules/council/evaluations";
import { ContextBar, ctxQuery } from "@/components/conselho/context-bar";
import { PrintButton } from "@/components/conselho/print-button";

const stateLabel: Record<PanelRow["state"], string> = {
  concluida: "Concluída", em_andamento: "Em andamento", nao_iniciada: "Não iniciada", sem_alunos: "Sem alunos",
};
const stateStyle: Record<PanelRow["state"], string> = {
  concluida: "bg-primary-light text-primary-dark", em_andamento: "bg-accent/20 text-foreground",
  nao_iniciada: "bg-danger/10 text-danger", sem_alunos: "bg-background text-muted",
};

export default async function PainelPage({ searchParams }: { searchParams: Promise<ContextParams> }) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "coordinator")) redirect("/dashboard/conselho");
  const actor = { userId: session.userId, role: session.role };
  const ctx = await loadPageContext(actor, await searchParams);
  if (!ctx || !ctx.period) redirect("/dashboard/conselho");
  const panel = await getPanel(actor, ctx.schoolId, ctx.period.id);
  if (!panel) redirect("/dashboard/conselho");
  const qs = ctxQuery(ctx);
  const pending = panel.rows.filter((r) => r.state !== "concluida" && r.state !== "sem_alunos");

  return (
    <div>
      <Link href="/dashboard/conselho" className="text-sm text-primary-dark hover:underline print:hidden">← Conselho de Classe</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-foreground">Painel da coordenação — {panel.period.name} de {ctx.year}</h1>
        <PrintButton />
      </div>
      <ContextBar ctx={ctx} />

      <p className="mt-6 text-sm text-muted">
        {panel.totals.concluded} de {panel.totals.assignments} vínculos concluídos · {panel.totals.inProgress} em andamento ·{" "}
        {panel.totals.notStarted} não iniciados.
      </p>

      {panel.classesWithoutAssignments.length > 0 && (
        <p className="mt-3 rounded-md bg-accent/15 px-4 py-3 text-sm text-foreground">
          Turmas sem nenhuma disciplina vinculada: <strong>{panel.classesWithoutAssignments.map((c) => c.name).join(", ")}</strong>.
          Faça os vínculos em Configuração.
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs text-muted">
            <tr><th className="px-4 py-2">Turma</th><th className="px-4 py-2">Disciplina</th><th className="px-4 py-2">Professor(a)</th>
              <th className="px-4 py-2">Finalizadas</th><th className="px-4 py-2">Rascunhos</th><th className="px-4 py-2">Situação</th><th className="px-4 py-2 print:hidden" /></tr>
          </thead>
          <tbody>
            {panel.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Nenhum vínculo cadastrado neste ano.</td></tr>}
            {panel.rows.map((r) => (
              <tr key={r.assignment_id} className="border-t border-border">
                <td className="px-4 py-2">{r.class_name}</td><td className="px-4 py-2">{r.subject_name}</td>
                <td className="px-4 py-2">{r.teacher_name}</td>
                <td className="px-4 py-2">{r.final}/{r.total}</td><td className="px-4 py-2">{r.draft}</td>
                <td className="px-4 py-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateStyle[r.state]}`}>{stateLabel[r.state]}</span></td>
                <td className="px-4 py-2 print:hidden"><Link className="text-primary-dark hover:underline" href={`/dashboard/conselho/avaliar/${r.assignment_id}?period=${panel.period.id}`}>Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">Pendências ({pending.length})</h2>
          <ul className="mt-2 list-disc pl-6 text-sm text-foreground">
            {pending.map((r) => (
              <li key={r.assignment_id}>{r.class_name} · {r.subject_name} — {r.teacher_name}: faltam {r.total - r.final} de {r.total}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-6 print:hidden"><Link className="text-primary-dark hover:underline" href={`/dashboard/conselho/relatorio?${qs}`}>Ir para os relatórios →</Link></p>
    </div>
  );
}
