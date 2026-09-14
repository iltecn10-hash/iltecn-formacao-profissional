import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getStudentWorkById } from "@/modules/student-works/queries";
import { SpreadsheetWorkEditor } from "@/components/spreadsheet-editor/spreadsheet-work-editor";

export default async function SpreadsheetWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const work = await getStudentWorkById(id);
  if (!work || work.work_type !== "SPREADSHEET") {
    notFound();
  }

  const studentId = await getStudentIdByUserId(session.userId);
  if (work.student_id !== studentId) {
    redirect("/dashboard/trabalhos");
  }

  return (
    <div>
      <Link
        href="/dashboard/trabalhos"
        className="text-sm text-muted underline underline-offset-2 print:hidden"
      >
        ← Meus Trabalhos
      </Link>
      <p className="mt-2 text-xs uppercase tracking-wide text-muted print:hidden">
        {work.mission_title}
      </p>
      <div className="mt-2">
        <SpreadsheetWorkEditor work={work} />
      </div>
    </div>
  );
}
