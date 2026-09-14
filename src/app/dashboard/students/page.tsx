import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listStudents } from "@/modules/students/queries";
import { listSchools } from "@/modules/schools/queries";
import { StudentForm } from "@/components/student-form";

export default async function StudentsPage() {
  const session = await getSession();
  if (!session || session.role === "student") {
    redirect("/dashboard");
  }

  const [students, schools] = await Promise.all([listStudents(), listSchools()]);
  const canCreate = session.role === "admin" || session.role === "teacher";

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Alunos</h1>
      <p className="mt-1 text-muted">Alunos matriculados na plataforma.</p>

      {canCreate && (
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Cadastrar aluno
          </h2>
          <div className="mt-4">
            <StudentForm schools={schools} />
          </div>
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Nome</th>
              <th className="px-5 py-3 font-medium text-muted">E-mail</th>
              <th className="px-5 py-3 font-medium text-muted">Nível</th>
              <th className="px-5 py-3 font-medium text-muted">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-muted">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
