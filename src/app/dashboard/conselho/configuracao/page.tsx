import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadPageContext, type ContextParams } from "@/modules/council/context";
import { listAssignments, listCriteria, listSubjects } from "@/modules/council/queries";
import { listClasses } from "@/modules/classes/queries";
import { listTeachers } from "@/modules/teachers/queries";
import { ContextBar } from "@/components/conselho/context-bar";
import { CouncilSetup } from "@/components/conselho/council-setup";

export default async function ConfiguracaoPage({ searchParams }: { searchParams: Promise<ContextParams> }) {
  const session = await getSession();
  if (!session || session.role === "student") redirect("/dashboard");
  const actor = { userId: session.userId, role: session.role };
  const ctx = await loadPageContext(actor, await searchParams);
  if (!ctx) redirect("/dashboard/conselho");
  const manager = session.role !== "teacher";

  const [subjects, criteria, assignments, classes, teachers] = await Promise.all([
    listSubjects(ctx.schoolId, manager),
    manager ? listCriteria(ctx.schoolId, true) : Promise.resolve([]),
    listAssignments(actor, ctx.schoolId),
    listClasses(actor),
    listTeachers(actor),
  ]);
  const myTeacher = teachers.find((t) => t.user_id === session.userId) ?? null;
  const schoolClasses = classes
    .filter((c) => c.school_id === ctx.schoolId && c.school_year === ctx.year)
    .filter((c) => manager || (myTeacher && c.teacher_id === myTeacher.id));

  return (
    <div>
      <Link href="/dashboard/conselho" className="text-sm text-primary-dark hover:underline">← Conselho de Classe</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Configuração do Conselho de Classe</h1>
      <p className="mt-1 text-muted">
        {manager ? "Disciplinas, bimestres, critérios do formulário e vínculos entre turma, disciplina e professor."
          : "Cadastre disciplinas novas e vincule-se às turmas pelas quais você é responsável."}
      </p>
      <ContextBar ctx={ctx} />
      <CouncilSetup
        manager={manager} schoolId={ctx.schoolId} year={ctx.year}
        subjects={subjects} periods={ctx.periods} criteria={criteria}
        assignments={assignments.filter((a) => a.school_year === ctx.year)}
        classes={schoolClasses.map((c) => ({ id: c.id, name: c.name }))}
        teachers={teachers.filter((t) => t.school_id === ctx.schoolId && (manager || t.id === myTeacher?.id))
          .map((t) => ({ id: t.id, name: t.name ?? "" }))}
      />
    </div>
  );
}
