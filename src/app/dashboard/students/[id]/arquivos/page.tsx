import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { canActorViewStudent } from "@/modules/students/access";
import { listDeliveriesForStudent } from "@/modules/assignments/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_LABEL = { submitted: "Aguardando avaliação", returned: "Devolvida para refazer", evaluated: "Avaliada" } as const;

function kb(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

export default async function ArquivosDoAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "student") redirect("/dashboard");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const actor = { userId: session.userId, role: session.role };
  if (!(await canActorViewStudent(actor, id))) notFound();

  const student = await queryOne<{ name: string; email: string }>(
    `SELECT u.name, u.email FROM students st JOIN users u ON u.id = st.user_id WHERE st.id = $1::uuid`,
    [id]
  );
  if (!student) notFound();
  const deliveries = await listDeliveriesForStudent(actor, id);

  return (
    <div>
      <Link href="/dashboard/students" className="text-sm text-primary underline underline-offset-2">
        ← Voltar para alunos
      </Link>
      <h1 className="mt-3 font-heading text-2xl font-bold text-foreground">Arquivos enviados por {student.name}</h1>
      <p className="mt-1 text-muted">{student.email} · Entregas das atividades da turma.</p>

      <div className="mt-6 flex flex-col gap-4">
        {deliveries.length === 0 && <p className="card p-5 text-sm text-muted">Este aluno ainda não enviou nenhum arquivo.</p>}
        {deliveries.map((d) => (
          <div key={d.submission_id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/dashboard/atividades/${d.assignment_id}`} className="font-medium text-primary underline underline-offset-2">
                {d.assignment_title}
              </Link>
              <span className="text-xs text-muted">{d.class_name}</span>
              <span className={`badge ${d.status === "evaluated" ? "badge-success" : "badge-info"}`}>{STATUS_LABEL[d.status]}</span>
              {d.late && <span className="badge badge-danger">Fora do prazo</span>}
              {d.score != null && <span className="text-sm font-medium">Nota: {d.score}</span>}
            </div>
            <p className="mt-1 text-xs text-muted">
              Enviado em {new Date(d.submitted_at).toLocaleString("pt-BR", { timeZone: "America/Belem" })}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {d.files.map((f) => (
                <li key={f.id}>
                  <a href={`/api/assignments/files/${f.id}`} className="text-sm font-medium text-primary underline underline-offset-2">
                    ⬇ {f.file_name}
                  </a>{" "}
                  <span className="text-xs text-muted">({kb(f.size_bytes)})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
