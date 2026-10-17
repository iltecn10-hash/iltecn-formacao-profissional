import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { RecordError } from "@/modules/registry/records";
import { getClassRoster } from "@/modules/classes/enrollments";
import { ClassRoster } from "@/components/class-roster";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TurmaAlunosPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "student") redirect("/dashboard");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let roster;
  try {
    roster = await getClassRoster({ userId: session.userId, role: session.role }, id);
  } catch (err) {
    if (err instanceof RecordError) notFound();
    throw err;
  }
  return (
    <div>
      <Link href="/dashboard/classes" className="text-sm text-primary underline underline-offset-2">
        ← Voltar para turmas
      </Link>
      <h1 className="mt-3 font-heading text-2xl font-bold text-foreground">Alunos da turma {roster.class.name}</h1>
      <p className="mt-1 text-muted">Matricule os alunos para que eles vejam as atividades desta turma.</p>
      <ClassRoster
        classId={roster.class.id}
        className={roster.class.name}
        enrolled={roster.enrolled}
        available={roster.available}
      />
    </div>
  );
}
