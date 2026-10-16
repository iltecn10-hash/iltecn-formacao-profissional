import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadPageContext, type ContextParams } from "@/modules/council/context";
import { getClassReport } from "@/modules/council/evaluations";
import { listClasses } from "@/modules/classes/queries";
import { ContextBar } from "@/components/conselho/context-bar";
import { PrintButton } from "@/components/conselho/print-button";

export default async function RelatorioPage({ searchParams }: { searchParams: Promise<ContextParams & { class?: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "coordinator")) redirect("/dashboard/conselho");
  const actor = { userId: session.userId, role: session.role };
  const sp = await searchParams;
  const ctx = await loadPageContext(actor, sp);
  if (!ctx || !ctx.period) redirect("/dashboard/conselho");
  const classes = (await listClasses(actor)).filter((c) => c.school_id === ctx.schoolId && c.school_year === ctx.year);
  const selected = classes.find((c) => c.id === sp.class);
  const report = selected ? await getClassReport(actor, selected.id, ctx.period.id) : null;

  return (
    <div>
      <Link href="/dashboard/conselho" className="text-sm text-primary-dark hover:underline print:hidden">← Conselho de Classe</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Relatório consolidado da turma</h1>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
        {ctx.schools.length > 0 && <input type="hidden" name="school" value={ctx.schoolId} />}
        <input type="hidden" name="year" value={ctx.year} />
        <input type="hidden" name="period" value={ctx.period.id} />
        <label className="text-xs font-medium text-muted">Turma
          <select name="class" defaultValue={selected?.id ?? ""} className="mt-1 block rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <option value="">Selecione…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">Gerar</button>
      </form>
      <ContextBar ctx={ctx} extra={selected ? { class: selected.id } : undefined} />

      {!selected && <p className="mt-6 text-sm text-muted">Escolha uma turma para ver o consolidado do {ctx.period.name}.</p>}
      {selected && !report && <p className="mt-6 text-sm text-muted">Nada encontrado para esta turma e bimestre.</p>}
      {report && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">{report.class_name} · {report.period.name} de {ctx.year}</h2>
            <div className="flex gap-2">
              <a className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-background print:hidden"
                href={`/api/conselho/relatorios/turma?classId=${selected!.id}&periodId=${ctx.period.id}&format=csv`}>Baixar CSV</a>
              <PrintButton />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">
            Considera apenas avaliações finalizadas. {report.pendingCount > 0 ? `${report.pendingCount} ainda pendente(s). ` : ""}
            Documento de apoio pedagógico — não é nota oficial nem decisão de aprovação. Contém dados de alunos: não compartilhe fora da escola.
          </p>

          <h3 className="mt-6 text-sm font-semibold text-muted">Resumo da turma</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {report.summary.map((s) => (
              <div key={s.code} className="card p-4">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <ul className="mt-1 text-sm text-muted">
                  {Object.entries(s.counts).map(([v, n]) => <li key={v}>{s.valueLabels[v]}: <strong className="text-foreground">{n}</strong></li>)}
                </ul>
              </div>
            ))}
            {report.summary.length === 0 && <p className="text-sm text-muted">Ainda não há avaliações finalizadas.</p>}
          </div>

          <h3 className="mt-6 text-sm font-semibold text-muted">Alunos que pedem atenção</h3>
          <ul className="mt-2 list-disc pl-6 text-sm">
            {report.students.filter((s) => s.attention.length).map((s) => (
              <li key={s.student_id}><Link className="text-primary-dark hover:underline" href={`/dashboard/conselho/relatorio/aluno/${s.student_id}`}>{s.name}</Link>: {s.attention.join("; ")}</li>
            ))}
            {report.students.every((s) => !s.attention.length) && <li className="list-none text-muted">Nenhum aluno sinalizado.</li>}
          </ul>

          <h3 className="mt-6 text-sm font-semibold text-muted">Rendimento por aluno e disciplina</h3>
          <div className="mt-2 overflow-x-auto card">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-xs text-muted"><tr>
                <th className="px-3 py-2">Aluno</th>{report.subjects.map((s) => <th key={s} className="px-3 py-2">{s}</th>)}</tr></thead>
              <tbody>
                {report.students.map((st) => (
                  <tr key={st.student_id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{st.name}</td>
                    {report.subjects.map((sub) => {
                      const a = st.bySubject[sub];
                      return <td key={sub} className="px-3 py-2 text-muted">
                        {a ? <>{a.rendimento?.valueLabel ?? "—"}<br /><span className="text-xs">{a.avanco?.valueLabel ?? ""}</span></> : "—"}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
