import { validateCertificate } from "@/modules/lab/queries";

export const metadata = { title: "Validar certificado — ILTECN" };

/** Página PÚBLICA: confirma que o código existe, mostrando o mínimo de dados da criança. */
export default async function ValidarPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await validateCertificate(decodeURIComponent(code));

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
      <p className="text-sm font-bold tracking-widest text-primary">ILTECN — FORMAÇÃO PROFISSIONAL</p>
      <h1 className="mt-2 font-heading text-3xl font-bold">Validação de certificado</h1>
      {cert ? (
        <div className="mt-6 rounded-3xl border-4 border-primary bg-surface p-6">
          <p className="text-xl font-bold text-primary-dark">✅ Certificado válido</p>
          <dl className="mt-4 space-y-2 text-base">
            <div><dt className="text-sm text-muted">Aluno(a)</dt><dd className="font-semibold">{cert.studentLabel}</dd></div>
            <div><dt className="text-sm text-muted">Programa</dt><dd className="font-semibold">{cert.trackName}</dd></div>
            <div><dt className="text-sm text-muted">Carga horária</dt><dd className="font-semibold">{cert.workloadHours} horas</dd></div>
            <div><dt className="text-sm text-muted">Instituição</dt><dd className="font-semibold">{cert.schoolName}</dd></div>
            <div><dt className="text-sm text-muted">Emitido em</dt><dd className="font-semibold">{new Date(cert.issuedAt).toLocaleDateString("pt-BR")}</dd></div>
            <div><dt className="text-sm text-muted">Código</dt><dd className="font-mono font-bold">{cert.code}</dd></div>
          </dl>
        </div>
      ) : (
        <p className="mt-6 rounded-3xl border-2 border-danger bg-danger/10 p-6 text-lg font-semibold text-danger">
          ❌ Código não encontrado. Confira se digitou certinho.
        </p>
      )}
    </main>
  );
}
