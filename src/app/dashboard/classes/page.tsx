import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClasses } from "@/modules/classes/queries";
import { listSchools } from "@/modules/schools/queries";
import { listTeachers } from "@/modules/teachers/queries";
import { getActorSchoolId } from "@/modules/schools/scope";
import Link from "next/link";
import { ClassForm } from "@/components/class-form";
import { RecordActions } from "@/components/record-actions";

const shiftLabel: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  integral: "Integral",
};

export default async function ClassesPage() {
  const session = await getSession();
  if (!session || session.role === "student") {
    redirect("/dashboard");
  }

  const actor = { userId: session.userId, role: session.role };
  const [classes, allSchools, teachers] = await Promise.all([
    listClasses(actor),
    listSchools(),
    listTeachers(actor),
  ]);
  // Professor só escolhe a própria escola no formulário (a rota também confere no servidor).
  const mySchoolId = session.role === "admin" ? null : await getActorSchoolId(actor);
  const schools =
    session.role === "admin" ? allSchools : allSchools.filter((sc) => sc.id === mySchoolId);
  const canCreate = session.role === "admin" || session.role === "teacher";
  const myTeacherId = teachers.find((t) => t.user_id === session.userId)?.id ?? null;
  const canManage = session.role === "admin" || session.role === "coordinator";

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Turmas</h1>
      <p className="mt-1 text-muted">Turmas ativas por escola e ano letivo.</p>

      {canCreate && (
        <div className="mt-8 card p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Criar turma
          </h2>
          <div className="mt-4">
            <ClassForm schools={schools} teachers={teachers} />
          </div>
        </div>
      )}

      <div className="mt-8 card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Turma</th>
              <th className="px-5 py-3 font-medium text-muted">Professor</th>
              <th className="px-5 py-3 font-medium text-muted">Turno</th>
              <th className="px-5 py-3 font-medium text-muted">Ano</th>
              <th className="px-5 py-3 font-medium text-muted">Alunos</th>
              <th className="px-5 py-3 font-medium text-muted">Situação</th>
              <th className="px-5 py-3 font-medium text-muted">Ações</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted">
                  Nenhuma turma criada ainda.
                </td>
              </tr>
            )}
            {classes.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                <td className="px-5 py-3 text-muted">{c.teacher_name ?? "—"}</td>
                <td className="px-5 py-3 text-muted">
                  {c.shift ? shiftLabel[c.shift] : "—"}
                </td>
                <td className="px-5 py-3 text-muted">{c.school_year}</td>
                <td className="px-5 py-3 text-muted">
                  {c.student_count ?? 0}
                  {(canManage || (myTeacherId !== null && c.teacher_id === myTeacherId)) && (
                    <Link
                      href={`/dashboard/classes/${c.id}/alunos`}
                      className="ml-2 text-sm font-medium text-primary underline underline-offset-2"
                    >
                      Matricular alunos
                    </Link>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`badge ${c.active ? "badge-success" : "badge-danger"}`}>
                    {c.active ? "Ativa" : "Desativada"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {(canManage || (myTeacherId !== null && c.teacher_id === myTeacherId)) && (
                    <RecordActions
                      endpoint={`/api/classes/${c.id}`}
                      label={c.name}
                      active={c.active}
                      canDelete={canManage}
                      fields={[
                        { name: "name", label: "Nome da turma", value: c.name, required: true },
                        {
                          name: "shift",
                          label: "Turno",
                          value: c.shift ?? "",
                          type: "select",
                          options: [
                            { value: "", label: "—" },
                            ...Object.entries(shiftLabel).map(([value, label]) => ({ value, label })),
                          ],
                        },
                        { name: "schoolYear", label: "Ano letivo", value: c.school_year, type: "number", required: true },
                        {
                          name: "teacherId",
                          label: "Professor",
                          value: c.teacher_id ?? "",
                          type: "select",
                          options: [
                            { value: "", label: "— sem professor —" },
                            ...teachers
                              .filter((t) => t.school_id === c.school_id)
                              .map((t) => ({ value: t.id, label: t.name ?? t.email ?? "professor" })),
                          ],
                        },
                      ]}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
