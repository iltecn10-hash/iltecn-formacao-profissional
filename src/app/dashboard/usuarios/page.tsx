import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listManagedUsers } from "@/modules/users/queries";
import { UserResetButton } from "@/components/user-reset-button";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  coordinator: "Coordenador",
  teacher: "Professor",
  student: "Aluno",
};

export default async function UsersPage() {
  const session = await getSession();
  if (!session || session.role === "student") redirect("/dashboard");

  const users = await listManagedUsers({ userId: session.userId, role: session.role });
  const scopeText =
    session.role === "admin"
      ? "Todas as contas da plataforma."
      : session.role === "coordinator"
        ? "Professores e alunos da sua escola."
        : "Alunos das suas turmas.";

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Acessos e senhas</h1>
      <p className="mt-1 text-muted">
        {scopeText} Aqui você vê o login (e-mail) de cada pessoa e gera uma senha provisória
        quando alguém esquecer a senha. A senha atual nunca pode ser vista — fica guardada
        de forma protegida.
      </p>

      <div className="mt-6 card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Nome</th>
              <th className="px-5 py-3 font-medium text-muted">Login (e-mail)</th>
              <th className="px-5 py-3 font-medium text-muted">Perfil</th>
              <th className="px-5 py-3 font-medium text-muted">Situação</th>
              <th className="px-5 py-3 font-medium text-muted">Senha</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  Nenhuma conta no seu acesso.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{u.name}</td>
                <td className="px-5 py-3 text-muted">{u.email}</td>
                <td className="px-5 py-3 text-muted">{ROLE_LABEL[u.role] ?? u.role}</td>
                <td className="px-5 py-3">
                  <span className={u.active ? "badge badge-success" : "badge badge-danger"}>
                    {u.active ? "Ativo" : "Desativado"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <UserResetButton userId={u.id} userName={u.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
