import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getLabLesson, LabError } from "@/modules/lab/queries";
import { LessonPlayer } from "@/components/lab/lesson-player";
import { Lia, LIA_MESSAGES } from "@/components/lab/lia";

export default async function AulaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/dashboard");
  const studentId = await getStudentIdByUserId(session.userId);
  if (!studentId) redirect("/dashboard");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let lesson: Awaited<ReturnType<typeof getLabLesson>> | null = null;
  let blocked = false;
  try {
    lesson = await getLabLesson(studentId, id);
  } catch (err) {
    if (err instanceof LabError && err.code === "locked") blocked = true;
    else if (err instanceof LabError && err.code === "forbidden") redirect("/dashboard");
    else notFound();
  }

  if (blocked || !lesson) {
    return (
      <div className="space-y-4">
        <Lia text={LIA_MESSAGES.locked} />
        <Link href="/dashboard/lab" className="font-semibold text-primary underline">← Voltar ao meu painel</Link>
      </div>
    );
  }
  return <LessonPlayer lesson={lesson} />;
}
