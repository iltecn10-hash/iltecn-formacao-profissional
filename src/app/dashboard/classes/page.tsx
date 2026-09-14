import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClasses } from "@/modules/classes/queries";
import { listSchools } from "@/modules/schools/queries";
import { listTeachers } from "@/modules/teachers/queries";
import { ClassForm } from "@/components/class-form";

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

  const [classes, schools, teachers] = await Promise.all([
    listClasses(),
    listSchools(),
    listTeachers(),
  ]);
  const canCreate = session.role === "admin" || session.role === "teacher";

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Turmas</h1>
      <p className="mt-1 text-muted">Turmas ativas por escola e ano letivo.</p>

      {canCreate && (
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Criar turma
          </h2>
          <div className="mt-4">
            <ClassForm schools={schools} teachers={teachers} />
          </div>
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Turma</th>
              <th className="px-5 py-3 font-medium text-muted">Professor</th>
              <th className="px-5 py-3 font-medium text-muted">Turno</th>
              <th className="px-5 py-3 font-medium text-muted">Ano</th>
              <th className="px-5 py-3 font-medium text-muted">Alunos</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
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
                <td className="px-5 py-3 text-muted">{c.student_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
