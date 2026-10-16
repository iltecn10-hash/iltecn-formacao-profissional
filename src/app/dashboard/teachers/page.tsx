import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listTeachers } from "@/modules/teachers/queries";
import { listSchools } from "@/modules/schools/queries";
import { TeacherForm } from "@/components/teacher-form";
import { RecordActions } from "@/components/record-actions";

export default async function TeachersPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  const [teachers, schools] = await Promise.all([listTeachers({ userId: session.userId, role: session.role }), listSchools()]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Professores
      </h1>
      <p className="mt-1 text-muted">Corpo docente cadastrado.</p>

      <div className="mt-8 card p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Cadastrar professor
        </h2>
        <div className="mt-4">
          <TeacherForm schools={schools} />
        </div>
      </div>

      <div className="mt-8 card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Nome</th>
              <th className="px-5 py-3 font-medium text-muted">E-mail</th>
              <th className="px-5 py-3 font-medium text-muted">Situação</th>
              <th className="px-5 py-3 font-medium text-muted">Ações</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-muted">
                  Nenhum professor cadastrado ainda.
                </td>
              </tr>
            )}
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{t.name}</td>
                <td className="px-5 py-3 text-muted">{t.email}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${t.active === false ? "badge-danger" : "badge-success"}`}>
                    {t.active === false ? "Desativado" : "Ativo"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <RecordActions
                    endpoint={`/api/teachers/${t.id}`}
                    label={t.name ?? t.email ?? "professor"}
                    active={t.active !== false}
                    fields={[
                      { name: "name", label: "Nome", value: t.name, required: true },
                      { name: "email", label: "E-mail (login)", value: t.email, type: "email", required: true },
                      { name: "bio", label: "Apresentação", value: t.bio, type: "textarea" },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
