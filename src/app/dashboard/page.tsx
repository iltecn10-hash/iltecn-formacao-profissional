import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { StatCard } from "@/components/stat-card";
import { ProgressBar } from "@/components/progress-bar";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getStudentProgress } from "@/modules/missions/queries";

async function getCounts() {
  const [schools, teachers, students, classes] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) FROM schools`),
    query<{ count: string }>(`SELECT COUNT(*) FROM teachers`),
    query<{ count: string }>(`SELECT COUNT(*) FROM students`),
    query<{ count: string }>(`SELECT COUNT(*) FROM classes`),
  ]);
  return {
    schools: Number(schools[0]?.count ?? 0),
    teachers: Number(teachers[0]?.count ?? 0),
    students: Number(students[0]?.count ?? 0),
    classes: Number(classes[0]?.count ?? 0),
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  if (session.role === "student") {
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

        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
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

        <div className="mt-6 rounded-lg border border-border bg-surface p-6 text-sm text-muted">
          Vá até <span className="font-medium text-foreground">Missões</span>{" "}
          no menu lateral para começar suas tarefas práticas.
        </div>
      </div>
    );
  }

  const counts = await getCounts();

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

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Escolas" value={counts.schools} />
        <StatCard label="Professores" value={counts.teachers} />
        <StatCard label="Alunos" value={counts.students} />
        <StatCard label="Turmas" value={counts.classes} />
      </div>
    </div>
  );
}
