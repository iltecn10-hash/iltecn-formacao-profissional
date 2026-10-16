import Link from "next/link";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { StatCard } from "@/components/stat-card";
import { ProgressBar } from "@/components/progress-bar";
import { redirect } from "next/navigation";
import { getStudentIdByUserId, isKidsStudent } from "@/modules/students/queries";
import { getStudentProgress } from "@/modules/missions/queries";
import { listStudents } from "@/modules/students/queries";
import { listTeachers } from "@/modules/teachers/queries";
import { listClasses } from "@/modules/classes/queries";
import { countWorksAwaitingReview } from "@/modules/student-works/queries";
import { getActorSchoolId } from "@/modules/schools/scope";
import type { UserRole } from "@/types";

/** Números do painel da equipe — sempre dentro do escopo do perfil (mesmas regras das listagens). */
async function getCounts(actor: { userId: string; role: UserRole }) {
  const [students, teachers, classes, awaiting, schools] = await Promise.all([
    listStudents(actor),
    listTeachers(actor),
    listClasses(actor),
    countWorksAwaitingReview(actor),
    actor.role === "admin"
      ? query<{ count: string }>(`SELECT COUNT(*) FROM schools`).then((r) => Number(r[0]?.count ?? 0))
      : getActorSchoolId(actor).then((id) => (id ? 1 : 0)),
  ]);
  return {
    schools,
    teachers: teachers.length,
    students: students.length,
    classes: classes.length,
    awaiting,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  if (session.role === "student") {
    if (await isKidsStudent(session.userId)) redirect("/dashboard/lab");
    const studentId = await getStudentIdByUserId(session.userId);
    const tracks = studentId ? await getStudentProgress(studentId) : [];
    const overall =
      tracks.length === 0
        ? 0
        : Math.round(
            tracks.reduce((sum, t) => sum + t.progress_percent, 0) / tracks.length
          );

    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Olá, {session.name.split(" ")[0]}!
        </h1>
        <p className="mt-1 text-muted">
          Sua formação está {overall}% concluída.
        </p>

        <div className="mt-8 card p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Progresso por trilha
          </h2>
          <div className="mt-5 flex flex-col gap-4">
            {tracks.length === 0 && (
              <p className="text-sm text-muted">
                Ainda não há trilhas configuradas.
              </p>
            )}
            {tracks.map((t) => (
              <ProgressBar key={t.id} label={t.name} percent={t.progress_percent} />
            ))}
          </div>
        </div>

        <div className="mt-6 card p-6 text-sm text-muted">
          Vá até <span className="font-medium text-foreground">Missões</span>{" "}
          no menu lateral para começar suas tarefas práticas.
        </div>
      </div>
    );
  }

  const counts = await getCounts({ userId: session.userId, role: session.role });

  const roleGreeting: Record<string, string> = {
    admin: "Visão geral da plataforma",
    teacher: "Suas turmas e alunos",
    coordinator: "Acompanhamento das escolas",
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Olá, {session.name.split(" ")[0]}!
      </h1>
      <p className="mt-1 text-muted">{roleGreeting[session.role]}</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Alunos" value={counts.students} hint="no seu escopo" href="/dashboard/students" />
        <StatCard label="Turmas" value={counts.classes} hint="no seu escopo" href="/dashboard/classes" />
        <StatCard
          label="Trabalhos aguardando correção"
          value={counts.awaiting}
          hint={counts.awaiting === 0 ? "nenhum pendente" : "entregues pelos alunos"}
          href="/dashboard/trabalhos-alunos"
          tone={counts.awaiting === 0 ? "success" : "warning"}
        />
        {session.role === "admin" ? (
          <StatCard label="Escolas" value={counts.schools} href="/dashboard/schools" />
        ) : (
          <StatCard label="Professores" value={counts.teachers} hint="na sua escola" />
        )}
      </div>

      <h2 className="mt-10 font-heading text-lg font-semibold text-foreground">Acesso rápido</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/dashboard/conselho", title: "Conselho de Classe", text: "Avaliações do desempenho dos alunos por bimestre." },
          { href: "/dashboard/trabalhos-alunos", title: "Trabalhos dos Alunos", text: "Corrija e comente documentos e planilhas entregues." },
          { href: "/dashboard/relatorio", title: "Relatórios", text: "Desempenho por módulo e por aluno." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="card block p-5 transition hover:border-primary hover:shadow-md">
            <p className="font-semibold text-foreground">{c.title}</p>
            <p className="mt-1 text-sm text-muted">{c.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
