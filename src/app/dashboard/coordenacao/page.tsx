import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listSchools } from "@/modules/schools/queries";
import { listCoordinationMembers, POSITION_LABEL } from "@/modules/coordination/queries";
import { CoordinationForm } from "@/components/coordination-form";
import { RecordActions } from "@/components/record-actions";

export default async function CoordenacaoPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  const [members, schools] = await Promise.all([listCoordinationMembers(), listSchools()]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Coordenação e direção</h1>
      <p className="mt-1 text-muted">
        Coordenadores e diretores têm o mesmo acesso: acompanham a própria escola. Só o administrador cadastra.
      </p>

      <div className="mt-8 card p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Cadastrar coordenador ou diretor</h2>
        <div className="mt-4">
          <CoordinationForm schools={schools} />
        </div>
      </div>

      <div className="mt-8 card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Nome</th>
              <th className="px-5 py-3 font-medium text-muted">Cargo</th>
              <th className="px-5 py-3 font-medium text-muted">Escola</th>
              <th className="px-5 py-3 font-medium text-muted">E-mail</th>
              <th className="px-5 py-3 font-medium text-muted">Situação</th>
              <th className="px-5 py-3 font-medium text-muted">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted">
                  Nenhum coordenador ou diretor cadastrado ainda.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{m.name}</td>
                <td className="px-5 py-3 text-muted">{POSITION_LABEL[m.position]}</td>
                <td className="px-5 py-3 text-muted">{m.school_name ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{m.email}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${m.active ? "badge-success" : "badge-danger"}`}>
                    {m.active ? "Ativo" : "Desativado"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <RecordActions
                    endpoint={`/api/coordination/${m.id}`}
                    label={m.name}
                    active={m.active}
                    fields={[
                      {
                        name: "position",
                        label: "Cargo",
                        value: m.position,
                        type: "select",
                        required: true,
                        options: [
                          { value: "coordenador", label: "Coordenador" },
                          { value: "diretor", label: "Diretor" },
                        ],
                      },
                      {
                        name: "schoolId",
                        label: "Escola",
                        value: m.school_id,
                        type: "select",
                        required: true,
                        options: schools.map((s) => ({ value: s.id, label: s.name })),
                      },
                      { name: "name", label: "Nome", value: m.name, required: true },
                      { name: "email", label: "E-mail (login)", value: m.email, type: "email", required: true },
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
