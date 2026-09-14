import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listSchools } from "@/modules/schools/queries";
import { SchoolForm } from "@/components/school-form";

export default async function SchoolsPage() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "coordinator")) {
    redirect("/dashboard");
  }

  const schools = await listSchools();

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Escolas
      </h1>
      <p className="mt-1 text-muted">
        Instituições cadastradas na plataforma.
      </p>

      {session.role === "admin" && (
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Cadastrar escola
          </h2>
          <div className="mt-4">
            <SchoolForm />
          </div>
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Nome</th>
              <th className="px-5 py-3 font-medium text-muted">Código</th>
              <th className="px-5 py-3 font-medium text-muted">Cidade</th>
              <th className="px-5 py-3 font-medium text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-muted">
                  Nenhuma escola cadastrada ainda.
                </td>
              </tr>
            )}
            {schools.map((school) => (
              <tr key={school.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">
                  {school.name}
                </td>
                <td className="px-5 py-3 text-muted">{school.code ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{school.city ?? "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      school.active
                        ? "bg-primary-light text-primary-dark"
                        : "bg-border text-muted"
                    }`}
                  >
                    {school.active ? "Ativa" : "Inativa"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
