import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getAssignmentAccess,
  getMySubmission,
  listMaterials,
  listPendingStudents,
  listSubmissions,
  type FileMeta,
} from "@/modules/assignments/queries";
import { RecordActions } from "@/components/record-actions";
import { SubmitAssignmentForm } from "@/components/assignments/submit-form";
import { MaterialsManager } from "@/components/assignments/materials-manager";
import { EvaluateSubmissionForm } from "@/components/assignments/evaluate-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_LABEL = { submitted: "Entregue", returned: "Devolvida para refazer", evaluated: "Avaliada" } as const;

function formatDate(d: string | null) {
  if (!d) return "Sem prazo";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function kb(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

function FileLinks({ files }: { files: FileMeta[] }) {
  if (files.length === 0) return <p className="text-sm text-muted">Nenhum arquivo.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {files.map((f) => (
        <li key={f.id}>
          <a href={`/api/assignments/files/${f.id}`} className="text-sm font-medium text-primary underline underline-offset-2">
            ⬇ {f.file_name}
          </a>{" "}
          <span className="text-xs text-muted">({kb(f.size_bytes)})</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AtividadePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const acc = await getAssignmentAccess({ userId: session.userId, role: session.role }, id);
  if (!acc) notFound();
  const { assignment: a, level } = acc;
  const materials = await listMaterials(a.id);

  return (
    <div>
      <Link href="/dashboard/atividades" className="text-sm text-primary underline underline-offset-2">
        ← Voltar para atividades
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{a.title}</h1>
          <p className="mt-1 text-muted">
            {a.class_name} · Prazo: {formatDate(a.due_date)} · Nota máxima: {a.max_score}
            {a.closed ? " · Encerrada" : ""}
          </p>
        </div>
        {level === "manage" && (
          <RecordActions
            endpoint={`/api/assignments/${a.id}`}
            label={a.title}
            active={!a.closed}
            fields={[
              { name: "title", label: "Título", value: a.title, required: true },
              { name: "instructions", label: "Instruções", value: a.instructions, type: "textarea" },
              { name: "dueDate", label: "Prazo", value: a.due_date, type: "date" },
            ]}
          />
        )}
      </div>

      <div className="mt-6 card p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Instruções</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{a.instructions || "Sem instruções."}</p>
        <h3 className="mt-5 text-sm font-semibold text-foreground">Materiais do professor</h3>
        <div className="mt-2">
          <FileLinks files={materials} />
        </div>
        {level === "manage" && <MaterialsManager assignmentId={a.id} materials={materials} />}
      </div>

      {level === "student" && acc.studentId && (
        <StudentArea assignmentId={a.id} closed={a.closed} studentId={acc.studentId} assignment={a} />
      )}
      {level !== "student" && <StaffArea assignment={a} canEvaluate={level === "manage"} />}
    </div>
  );
}

async function StudentArea({
  assignment,
  studentId,
  closed,
  assignmentId,
}: {
  assignment: Awaited<ReturnType<typeof getAssignmentAccess>> extends infer T ? (T extends { assignment: infer A } ? A : never) : never;
  studentId: string;
  closed: boolean;
  assignmentId: string;
}) {
  const mine = await getMySubmission(assignment, studentId);
  return (
    <div className="mt-6 card p-6">
      <h2 className="font-heading text-lg font-semibold text-foreground">Sua entrega</h2>
      {mine && (
        <div className="mt-3 rounded-lg border border-border p-3 text-sm">
          <p>
            <span className={`badge ${mine.status === "evaluated" ? "badge-success" : "badge-info"}`}>{STATUS_LABEL[mine.status]}</span>
            {mine.late && <span className="badge badge-danger ml-2">Fora do prazo</span>}
            {mine.score != null && <span className="ml-2 font-medium">Nota: {mine.score}</span>}
          </p>
          {mine.feedback && <p className="mt-2 text-foreground">Comentário do professor: {mine.feedback}</p>}
          <div className="mt-3">
            <FileLinks files={mine.files} />
          </div>
        </div>
      )}
      <div className="mt-4">
        {closed ? (
          <p className="text-sm text-muted">Esta atividade foi encerrada pelo professor.</p>
        ) : mine?.status === "evaluated" ? (
          <p className="text-sm text-muted">Sua entrega já foi avaliada.</p>
        ) : (
          <SubmitAssignmentForm assignmentId={assignmentId} hasPrevious={!!mine} />
        )}
      </div>
    </div>
  );
}

async function StaffArea({
  assignment,
  canEvaluate,
}: {
  assignment: Awaited<ReturnType<typeof getAssignmentAccess>> extends infer T ? (T extends { assignment: infer A } ? A : never) : never;
  canEvaluate: boolean;
}) {
  const [subs, pending] = await Promise.all([listSubmissions(assignment), listPendingStudents(assignment)]);
  return (
    <div className="mt-6 card p-6">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Entregas ({subs.length} de {subs.length + pending.length})
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        {subs.length === 0 && <p className="text-sm text-muted">Ninguém entregou ainda.</p>}
        {subs.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{s.student_name}</p>
              <span className={`badge ${s.status === "evaluated" ? "badge-success" : "badge-info"}`}>{STATUS_LABEL[s.status]}</span>
              {s.late && <span className="badge badge-danger">Fora do prazo</span>}
              {s.score != null && <span className="text-sm font-medium">Nota: {s.score}</span>}
              <span className="text-xs text-muted">Enviado em {new Date(s.submitted_at).toLocaleString("pt-BR", { timeZone: "America/Belem" })}</span>
            </div>
            {s.comment && <p className="mt-2 text-sm text-foreground">Recado do aluno: {s.comment}</p>}
            <div className="mt-2">
              <FileLinks files={s.files} />
            </div>
            {canEvaluate && (
              <EvaluateSubmissionForm
                submissionId={s.id}
                maxScore={assignment.max_score}
                initialScore={s.score}
                initialFeedback={s.feedback}
              />
            )}
          </div>
        ))}
      </div>
      {pending.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Ainda não entregaram ({pending.length})</h3>
          <p className="mt-1 text-sm text-muted">{pending.map((p) => p.name).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
