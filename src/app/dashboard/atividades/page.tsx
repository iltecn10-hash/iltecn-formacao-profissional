import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  listAssignmentsForStaff,
  listAssignmentsForStudent,
  listManageableClasses,
} from "@/modules/assignments/queries";
import { NewAssignmentPanel } from "@/components/assignments/new-assignment-panel";
import { listSubjects } from "@/modules/council/queries";
import { RecordActions } from "@/components/record-actions";

const STATUS_LABEL = { submitted: "Entregue", returned: "Devolvida para refazer", evaluated: "Avaliada" } as const;

function formatDate(d: string | null) {
  if (!d) return "Sem prazo";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default async function AtividadesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const actor = { userId: session.userId, role: session.role };

  if (session.role === "student") {
    const list = await listAssignmentsForStudent(session.userId);
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Atividades</h1>
        <p className="mt-1 text-muted">Atividades enviadas pelos seus professores. Clique em uma atividade para baixar os materiais e anexar o seu arquivo.</p>
        <div className="mt-6 flex flex-col gap-3">
          {list.length === 0 && <p className="card p-5 text-sm text-muted">Nenhuma atividade por enquanto.</p>}
          {list.map((a) => (
            <Link key={a.id} href={`/dashboard/atividades/${a.id}`} className="card flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="text-xs text-muted">
                  {a.class_name}
                  {a.subject_name ? ` · ${a.subject_name}` : ""} · Prazo: {formatDate(a.due_date)}
                  {a.closed ? " · Encerrada" : ""}
                </p>
              </div>
              <span className={`badge ${a.submission_status === "evaluated" ? "badge-success" : a.submission_status ? "badge-info" : "badge-danger"}`}>
                {a.submission_status
                  ? STATUS_LABEL[a.submission_status] + (a.score != null ? ` · ${a.score}` : "")
                  : "Falta entregar"}
              </span>
              <span className="text-sm font-medium text-primary">{a.submission_status ? "Abrir" : "Abrir e anexar arquivo →"}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const [list, classes] = await Promise.all([listAssignmentsForStaff(actor), listManageableClasses(actor)]);
  const canCreate = session.role === "admin" || session.role === "teacher";
  const schoolIds = [...new Set([...classes.map((c) => c.school_id), ...list.map((a) => a.school_id)])];
  const subjects = (await Promise.all(schoolIds.map((id) => listSubjects(id)))).flat();

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Atividades da turma</h1>
      <p className="mt-1 text-muted">
        Cadastre atividades, deixe materiais para os alunos baixarem e veja o que cada um entregou.
      </p>

      {canCreate && <NewAssignmentPanel classes={classes} subjects={subjects} startOpen={list.length === 0} />}

      <div className="mt-8 card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Atividade</th>
              <th className="px-5 py-3 font-medium text-muted">Turma</th>
              <th className="px-5 py-3 font-medium text-muted">Disciplina</th>
              <th className="px-5 py-3 font-medium text-muted">Prazo</th>
              <th className="px-5 py-3 font-medium text-muted">Entregas</th>
              <th className="px-5 py-3 font-medium text-muted">Situação</th>
              {canCreate && <th className="px-5 py-3 font-medium text-muted">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={canCreate ? 7 : 6} className="px-5 py-8 text-center text-muted">
                  Nenhuma atividade cadastrada ainda.
                </td>
              </tr>
            )}
            {list.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">
                  <Link href={`/dashboard/atividades/${a.id}`} className="text-primary underline underline-offset-2">
                    {a.title}
                  </Link>
                </td>
                <td className="px-5 py-3 text-muted">{a.class_name}</td>
                <td className="px-5 py-3 text-muted">{a.subject_name ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{formatDate(a.due_date)}</td>
                <td className="px-5 py-3 text-muted">
                  {a.delivered} de {a.total_students}
                </td>
                <td className="px-5 py-3">
                  <span className={`badge ${a.closed ? "badge-danger" : "badge-success"}`}>{a.closed ? "Encerrada" : "Aberta"}</span>
                </td>
                {canCreate && (
                  <td className="px-5 py-3">
                    <RecordActions
                      endpoint={`/api/assignments/${a.id}`}
                      label={a.title}
                      active={!a.closed}
                      fields={[
                        { name: "title", label: "Título", value: a.title, required: true },
                        { name: "instructions", label: "Instruções", value: a.instructions, type: "textarea" },
                        {
                          name: "subjectId",
                          label: "Disciplina",
                          value: a.subject_id ?? "",
                          type: "select",
                          options: [
                            { value: "", label: "Sem disciplina específica" },
                            ...subjects.filter((x) => x.school_id === a.school_id).map((x) => ({ value: x.id, label: x.name })),
                          ],
                        },
                        { name: "dueDate", label: "Prazo", value: a.due_date, type: "date" },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
