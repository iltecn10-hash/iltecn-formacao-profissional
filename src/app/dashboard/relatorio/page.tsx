import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import {
  getStudentReport,
  listStudentsPerformance,
  getModulePerformance,
} from "@/modules/reports/queries";
import { levelName } from "@/lib/levels";
import { ProgressBar } from "@/components/progress-bar";

function StudentReportView({
  report,
}: {
  report: NonNullable<Awaited<ReturnType<typeof getStudentReport>>>;
}) {
  const pct =
    report.missionsTotal === 0
      ? 0
      : Math.round((report.missionsCompleted / report.missionsTotal) * 100);

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {report.student.name}
          </h2>
          <p className="text-sm text-muted">
            {report.student.school_name}
            {report.student.class_name ? ` · ${report.student.class_name}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-primary-dark">
            {levelName(report.student.level)}
          </p>
          <p className="text-xs text-muted">{report.student.points} pontos</p>
        </div>
      </div>

      <div className="mt-5">
        <ProgressBar label="Missões concluídas" percent={pct} />
        <p className="mt-1 text-xs text-muted">
          {report.missionsCompleted} de {report.missionsTotal} missões disponíveis
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-muted">Pontos fortes</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground">
            {report.strengths.length === 0 && (
              <li className="text-muted">Ainda sem dados suficientes.</li>
            )}
            {report.strengths.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted">Pontos a melhorar</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground">
            {report.improvements.length === 0 && (
              <li className="text-muted">Nenhum ponto crítico no momento.</li>
            )}
            {report.improvements.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-muted">Competências</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {report.competencies.map((c) => (
            <span
              key={c.name}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                c.score > 0
                  ? "bg-primary-light text-primary-dark"
                  : "border border-border text-muted"
              }`}
            >
              {c.name} · {c.score}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { studentId } = await searchParams;

  if (session.role === "student") {
    const ownId = await getStudentIdByUserId(session.userId);
    const report = ownId ? await getStudentReport(ownId) : null;
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Meu relatório
        </h1>
        <p className="mt-1 text-muted">Seu desempenho na formação até agora.</p>
        {report ? (
          <StudentReportView report={report} />
        ) : (
          <p className="mt-6 text-sm text-muted">
            Nenhum dado disponível ainda.
          </p>
        )}
      </div>
    );
  }

  const [students, modulePerformance] = await Promise.all([
    listStudentsPerformance(),
    getModulePerformance(),
  ]);

  const selected = studentId
    ? await getStudentReport(studentId)
    : students[0]
      ? await getStudentReport(students[0].student_id)
      : null;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Relatórios</h1>
      <p className="mt-1 text-muted">Desempenho por módulo e por aluno.</p>

      <div className="mt-8">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Desempenho por módulo
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {modulePerformance.map((m) => (
            <ProgressBar
              key={m.module_name}
              label={m.module_name}
              percent={Number(m.completion_rate) || 0}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <h3 className="text-sm font-semibold text-muted">Alunos</h3>
          <ul className="mt-3 flex flex-col gap-1">
            {students.map((s) => {
              const low = s.missions_completed === 0;
              return (
                <li key={s.student_id}>
                  <a
                    href={`/dashboard/relatorio?studentId=${s.student_id}`}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition hover:bg-background ${
                      selected?.student.id === s.student_id ? "bg-background" : ""
                    }`}
                  >
                    <span className="text-foreground">{s.name}</span>
                    {low && (
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                        sem progresso
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
            {students.length === 0 && (
              <li className="text-sm text-muted">Nenhum aluno cadastrado.</li>
            )}
          </ul>
        </div>

        <div>{selected && <StudentReportView report={selected} />}</div>
      </div>
    </div>
  );
}
