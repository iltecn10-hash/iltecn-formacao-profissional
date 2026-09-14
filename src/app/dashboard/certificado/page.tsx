import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getStudentReport } from "@/modules/reports/queries";
import { levelName } from "@/lib/levels";

export default async function CertificadoPage() {
  const session = await getSession();
  if (!session || session.role !== "student") {
    redirect("/dashboard");
  }

  const studentId = await getStudentIdByUserId(session.userId);
  const report = studentId ? await getStudentReport(studentId) : null;

  if (!report) {
    return <p className="text-sm text-muted">Nenhum dado disponível ainda.</p>;
  }

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Certificado de participação
      </h1>
      <p className="mt-1 text-muted">
        Um registro do seu progresso prático. Use o botão de imprimir do navegador para salvar em PDF.
      </p>

      <div className="mt-8 rounded-lg border-2 border-primary bg-surface p-10 text-center">
        <p className="text-sm font-semibold tracking-wide text-primary">
          ILTECN — FORMAÇÃO PROFISSIONAL
        </p>
        <h2 className="mt-6 font-heading text-xl text-muted">
          Certificado de Participação
        </h2>
        <p className="mt-6 text-lg text-foreground">
          Certificamos que <span className="font-heading font-bold">{report.student.name}</span>
        </p>
        <p className="mt-2 text-foreground">
          participou do programa de formação prática do ILTECN, concluindo{" "}
          <span className="font-semibold">{report.missionsCompleted}</span> missões práticas e
          atingindo o nível de <span className="font-semibold">{levelName(report.student.level)}</span>.
        </p>

        <p className="mx-auto mt-8 max-w-lg text-xs text-muted">
          Este certificado reconhece a participação e a prática em atividades simuladas de
          escritório e comércio. Ele <strong>não constitui certificação técnica oficial</strong>{" "}
          nem substitui uma formação profissional regulamentada.
        </p>

        <p className="mt-8 text-sm text-muted">{report.student.school_name} · {today}</p>
      </div>
    </div>
  );
}
