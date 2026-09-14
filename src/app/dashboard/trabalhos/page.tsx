import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import {
  listStudentWorksByStudent,
  listMissionsForNewWork,
} from "@/modules/student-works/queries";
import { NewDocumentForm } from "@/components/student-works/new-document-form";
import { NewSpreadsheetForm } from "@/components/student-works/new-spreadsheet-form";
import type { StudentWorkStatus } from "@/types";

const statusLabel: Record<StudentWorkStatus, string> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em andamento",
  SUBMITTED: "Entregue",
  RETURNED: "Devolvido",
  APPROVED: "Aprovado",
};

const statusStyle: Record<StudentWorkStatus, string> = {
  DRAFT: "bg-border text-muted",
  IN_PROGRESS: "bg-primary-light text-primary-dark",
  SUBMITTED: "bg-accent-light text-accent",
  RETURNED: "bg-danger/10 text-danger",
  APPROVED: "bg-primary text-white",
};

export default async function MeusTrabalhosPage() {
  const session = await getSession();
  if (!session || session.role !== "student") {
    redirect("/dashboard");
  }

  const studentId = await getStudentIdByUserId(session.userId);
  const [works, missions] = await Promise.all([
    studentId ? listStudentWorksByStudent(studentId) : Promise.resolve([]),
    listMissionsForNewWork(),
  ]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Meus Trabalhos</h1>
      <p className="mt-1 text-muted">
        Documentos e planilhas que você está produzindo nas missões práticas.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {works.length === 0 && (
            <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
              Você ainda não começou nenhum trabalho. Crie um documento ao lado.
            </p>
          )}
          {works.map((work) => (
            <div
              key={work.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium text-foreground">{work.title || "(sem título)"}</p>
                <p className="text-xs text-muted">
                  {work.mission_title} · {work.work_type === "DOCUMENT" ? "Documento" : "Planilha"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[work.status]}`}
                >
                  {statusLabel[work.status]}
                </span>
                <Link
                  href={`/dashboard/trabalhos/${
                    work.work_type === "DOCUMENT" ? "documento" : "planilha"
                  }/${work.id}`}
                  className="text-sm font-medium text-primary underline underline-offset-2"
                >
                  Abrir
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="flex h-fit flex-col gap-6">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="font-heading text-sm font-semibold text-foreground">Novo documento</h2>
            <div className="mt-4">
              <NewDocumentForm missions={missions} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="font-heading text-sm font-semibold text-foreground">Nova planilha</h2>
            <div className="mt-4">
              <NewSpreadsheetForm missions={missions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
