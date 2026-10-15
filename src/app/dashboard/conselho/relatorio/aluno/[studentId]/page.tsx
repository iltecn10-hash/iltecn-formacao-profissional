import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStudentCouncilReport } from "@/modules/council/evaluations";
import { PrintButton } from "@/components/conselho/print-button";

export default async function RelatorioAlunoPage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await getSession();
  if (!session || session.role === "student") redirect("/dashboard");
  const { studentId } = await params;
  if (!z.string().uuid().safeParse(studentId).success) notFound();
  const report = await getStudentCouncilReport({ userId: session.userId, role: session.role }, studentId);
  if (!report) notFound();

  const groups = new Map<string, typeof report.entries>();
  for (const e of report.entries) {
    const k = `${e.school_year} · ${e.period_name}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <div>
      <Link href="/dashboard/conselho" className="text-sm text-primary-dark hover:underline print:hidden">← Conselho de Classe</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{report.student.name}</h1>
          <p className="text-muted">{report.student.school_name} · Histórico do Conselho de Classe</p>
        </div>
        <PrintButton />
      </div>
      <p className="mt-2 text-xs text-muted">
        {session.role === "teacher" ? "Mostra apenas as avaliações feitas por você. " : ""}
        Somente avaliações finalizadas. Apoio pedagógico — não é nota oficial nem decisão de aprovação.
      </p>
      {groups.size === 0 && <p className="mt-6 rounded-lg border border-border bg-surface p-6 text-sm text-muted">Nenhuma avaliação finalizada para este aluno.</p>}
      {[...groups].map(([title, entries]) => (
        <section key={title} className="mt-6 break-inside-avoid">
          <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
          <div className="mt-2 flex flex-col gap-3">
            {entries.map((e) => (
              <div key={e.subject_name} className="rounded-lg border border-border bg-surface p-4">
                <p className="font-medium text-foreground">{e.subject_name}</p>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {Object.entries(e.answers).filter(([, a]) => a.valueLabel !== undefined).map(([code, a]) => (
                    <div key={code} className="flex justify-between gap-3"><dt className="text-muted">{a.label}</dt><dd className="font-medium">{a.valueLabel}</dd></div>
                  ))}
                </dl>
                {Object.entries(e.answers).filter(([, a]) => a.valueLabel === undefined && a.value).map(([code, a]) => (
                  <p key={code} className="mt-3 whitespace-pre-wrap text-sm"><span className="font-medium">{a.label}: </span>{a.value}</p>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
