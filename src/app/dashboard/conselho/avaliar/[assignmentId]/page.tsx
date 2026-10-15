import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getSheet } from "@/modules/council/evaluations";
import { EvaluationSheet } from "@/components/conselho/evaluation-sheet";

export default async function AvaliarPage({
  params, searchParams,
}: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ period?: string }> }) {
  const session = await getSession();
  if (!session || session.role === "student") redirect("/dashboard");
  const { assignmentId } = await params;
  const { period } = await searchParams;
  if (!z.string().uuid().safeParse(assignmentId).success || !z.string().uuid().safeParse(period).success) notFound();
  const sheet = await getSheet({ userId: session.userId, role: session.role }, assignmentId, period!);
  if (!sheet) notFound();

  const isTeacher = session.role === "teacher";
  return (
    <div>
      <Link href="/dashboard/conselho" className="text-sm text-primary-dark hover:underline print:hidden">← Conselho de Classe</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">
        {sheet.assignment.class_name} · {sheet.assignment.subject_name}
      </h1>
      <p className="text-muted">
        {sheet.period.name} de {sheet.assignment.school_year} · Professor(a) {sheet.assignment.teacher_name}
      </p>
      <EvaluationSheet
        sheet={sheet}
        editable={isTeacher && sheet.period.status === "open"}
        canReopen={!isTeacher}
      />
    </div>
  );
}
