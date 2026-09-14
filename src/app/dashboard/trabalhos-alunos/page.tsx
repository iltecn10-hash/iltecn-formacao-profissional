import { redirect } from "next/navigation";
import {
  getStudentWorkById,
  listStudentWorksForStaff,
} from "@/modules/student-works/queries";
import type { StudentWorkStatus } from "@/types";
import { getSession } from "@/lib/auth";
import { DocumentWorkEditor } from "@/components/document-editor/document-work-editor";
import { SpreadsheetWorkEditor } from "@/components/spreadsheet-editor/spreadsheet-work-editor";
import { ManualEvaluationForm } from "@/components/manual-evaluation-form";

const STAFF_ROLES = ["admin", "teacher", "coordinator"] as const;

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

export default async function TrabalhosAlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ workId?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session || !STAFF_ROLES.includes(session.role as (typeof STAFF_ROLES)[number])) {
    redirect("/dashboard");
  }

  const { workId, status } = await searchParams;

  const works = await listStudentWorksForStaff({ status });
  const selected = workId ? await getStudentWorkById(workId) : null;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Trabalhos dos Alunos</h1>
      <p className="mt-1 text-muted">
        Documentos e planilhas entregues pelos alunos nas missões práticas. Abra um trabalho para
        comentar e registrar uma avaliação.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <h3 className="text-sm font-semibold text-muted">Trabalhos</h3>
          <ul className="mt-3 flex flex-col gap-1">
            {works.map((w) => (
              <li key={w.id}>
                <a
                  href={`/dashboard/trabalhos-alunos?workId=${w.id}`}
                  className={`flex flex-col gap-1 rounded-md px-3 py-2 text-sm transition hover:bg-background ${
                    selected?.id === w.id ? "bg-background" : ""
                  }`}
                >
                  <span className="font-medium text-foreground">{w.student_name}</span>
                  <span className="text-xs text-muted">
                    {w.mission_title} · {w.work_type === "DOCUMENT" ? "Documento" : "Planilha"}
                  </span>
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[w.status]}`}
                  >
                    {statusLabel[w.status]}
                  </span>
                </a>
              </li>
            ))}
            {works.length === 0 && (
              <li className="text-sm text-muted">Nenhum trabalho encontrado.</li>
            )}
          </ul>
        </div>

        <div>
          {selected ? (
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted">
                {selected.mission_title} · {selected.student_name}
              </p>
              <div className="mt-2">
                {selected.work_type === "DOCUMENT" ? (
                  <DocumentWorkEditor work={selected} readOnly />
                ) : (
                  <SpreadsheetWorkEditor work={selected} readOnly />
                )}
              </div>
              {selected.submitted_at && <ManualEvaluationForm workId={selected.id} />}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
              Selecione um trabalho na lista ao lado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
