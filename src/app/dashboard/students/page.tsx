import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listStudents } from "@/modules/students/queries";
import { listSchools } from "@/modules/schools/queries";
import { getActorSchoolId } from "@/modules/schools/scope";
import { StudentForm } from "@/components/student-form";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { RecordActions } from "@/components/record-actions";

export default async function StudentsPage() {
  const session = await getSession();
  if (!session || session.role === "student") {
    redirect("/dashboard");
  }

  const actor = { userId: session.userId, role: session.role };
  const [students, allSchools] = await Promise.all([listStudents(actor), listSchools()]);
  // Professor só cadastra na própria escola (a rota também confere no servidor).
  const mySchoolId = session.role === "admin" ? null : await getActorSchoolId(actor);
  const schools =
    session.role === "admin" ? allSchools : allSchools.filter((sc) => sc.id === mySchoolId);
  const canCreate = session.role === "admin" || session.role === "teacher";

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Alunos</h1>
      <p className="mt-1 text-muted">Alunos matriculados na plataforma.</p>

      {canCreate && (
        <div className="mt-8 card p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Cadastrar aluno
          </h2>
          <div className="mt-4">
            <StudentForm schools={schools} />
          </div>
        </div>
      )}

      <div className="mt-8 card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Nome</th>
              <th className="px-5 py-3 font-medium text-muted">E-mail</th>
              <th className="px-5 py-3 font-medium text-muted">Nível</th>
              <th className="px-5 py-3 font-medium text-muted">Pontos</th>
              <th className="px-5 py-3 font-medium text-muted">Situação</th>
              <th className="px-5 py-3 font-medium text-muted">Arquivos</th>
              <th className="px-5 py-3 font-medium text-muted">Acesso</th>
              <th className="px-5 py-3 font-medium text-muted">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-muted">
                  Nenhum aluno cadastrado ainda.
                </td>
              </tr>
            )}
            {students.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                <td className="px-5 py-3 text-muted">{s.email}</td>
                <td className="px-5 py-3 text-muted">{s.level}</td>
                <td className="px-5 py-3 text-muted">{s.points}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${s.active === false ? "badge-danger" : "badge-success"}`}>
                    {s.active === false ? "Desativado" : "Ativo"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/dashboard/students/${s.id}/arquivos`} className="text-sm font-medium text-primary underline underline-offset-2">
                    Ver arquivos
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <ResetPasswordButton studentId={s.id} studentName={s.name ?? s.email ?? "aluno"} />
                </td>
                <td className="px-5 py-3">
                  <RecordActions
                    endpoint={`/api/students/${s.id}`}
                    label={s.name ?? s.email ?? "aluno"}
                    active={s.active !== false}
                    canDelete={session.role === "admin" || session.role === "coordinator"}
                    fields={[
                      { name: "name", label: "Nome", value: s.name, required: true },
                      { name: "email", label: "E-mail (login)", value: s.email, type: "email", required: true },
                      { name: "birthDate", label: "Data de nascimento", value: s.birth_date ? String(s.birth_date).slice(0, 10) : "", type: "date" },
                      { name: "guardianName", label: "Responsável", value: s.guardian_name },
                      { name: "guardianContact", label: "Contato do responsável", value: s.guardian_contact },
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
