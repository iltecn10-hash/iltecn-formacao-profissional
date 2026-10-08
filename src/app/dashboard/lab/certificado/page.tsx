import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getOwnCertificate } from "@/modules/lab/queries";
import { PrintButton } from "@/components/lab/print-button";

export default async function CertificadoLabPage() {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/dashboard");
  const studentId = await getStudentIdByUserId(session.userId);
  const cert = studentId ? await getOwnCertificate(studentId) : null;

  if (!cert) {
    return (
      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-bold">Certificado</h1>
        <p className="text-muted">Conclua as 30 aulas do ILTECN LAB para ganhar o seu certificado. 🎓</p>
        <Link href="/dashboard/lab" className="font-semibold text-primary underline">← Voltar ao meu painel</Link>
      </div>
    );
  }

  const date = new Date(cert.issuedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <div>
      <div className="print:hidden">
        <Link href="/dashboard/lab" className="text-sm font-semibold text-primary underline">← Voltar ao meu painel</Link>
        <p className="mt-2 text-muted">Use o botão para imprimir ou salvar em PDF.</p>
        <PrintButton />
      </div>
      <div className="mt-6 rounded-3xl border-4 border-primary bg-surface p-10 text-center">
        <p className="text-sm font-bold tracking-widest text-primary">ILTECN — FORMAÇÃO PROFISSIONAL</p>
        <h1 className="mt-6 font-heading text-3xl font-bold">Certificado de Conclusão</h1>
        <p className="mt-6 text-lg">Certificamos que</p>
        <p className="mt-2 font-heading text-3xl font-bold text-primary-dark">{cert.studentName}</p>
        <p className="mt-4 text-lg">
          concluiu o programa <strong>{cert.trackName}</strong>, com carga horária de <strong>{cert.workloadHours} horas</strong>,
          em <strong>30 aulas</strong> práticas, com avaliação <strong>{cert.evaluationLabel}</strong>.
        </p>
        <p className="mt-6 text-muted">{cert.schoolName} · {date}</p>
        <p className="mt-6 text-sm text-muted">Código de validação</p>
        <p className="font-mono text-2xl font-bold tracking-widest">{cert.code}</p>
        <p className="mt-1 text-xs text-muted">Confira em /validar/{cert.code}</p>
        <p className="mt-6 text-xs text-muted">Programa de alfabetização digital do ILTECN. Não substitui curso técnico regulamentado.</p>
      </div>
    </div>
  );
}
