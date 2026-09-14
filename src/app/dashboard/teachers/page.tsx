import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listTeachers } from "@/modules/teachers/queries";
import { listSchools } from "@/modules/schools/queries";
import { TeacherForm } from "@/components/teacher-form";

export default async function TeachersPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  const [teachers, schools] = await Promise.all([listTeachers(), listSchools()]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Professores
      </h1>
      <p className="mt-1 text-muted">Corpo docente cadastrado.</p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Cadastrar professor
        </h2>
        <div className="mt-4">
          <TeacherForm schools={schools} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Nome</th>
              <th className="px-5 py-3 font-medium text-muted">E-mail</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-muted">
                  Nenhum professor cadastrado ainda.
                </td>
              </tr>
            )}
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{t.name}</td>
                <td className="px-5 py-3 text-muted">{t.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
