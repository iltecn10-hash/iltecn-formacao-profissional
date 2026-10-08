import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getLabOverview } from "@/modules/lab/queries";
import { StudentOverview } from "@/components/lab/student-overview";
import { LabMonitor } from "@/components/lab/lab-monitor";

export default async function LabPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "student") {
    const studentId = await getStudentIdByUserId(session.userId);
    const data = studentId ? await getLabOverview(studentId) : null;
    if (!data) {
      return <p className="text-muted">O ILTECN LAB ainda não está liberado para o seu cadastro. Fale com o seu professor.</p>;
    }
    return <StudentOverview data={data} firstName={session.name.split(" ")[0]} />;
  }

  // Equipe: lista só as turmas que o perfil pode enxergar (o monitor aplica o mesmo escopo no SQL).
  let classes: { id: string; name: string }[] = [];
  if (session.role === "admin") {
    classes = await query<{ id: string; name: string }>(`SELECT id, name FROM classes WHERE active ORDER BY name ASC`);
  } else if (session.role === "teacher") {
    classes = await query<{ id: string; name: string }>(
      `SELECT c.id, c.name FROM classes c JOIN teachers t ON t.id = c.teacher_id
       WHERE t.user_id = $1 AND c.active ORDER BY c.name ASC`,
      [session.userId]
    );
  } else if (session.role === "coordinator") {
    classes = await query<{ id: string; name: string }>(
      `SELECT c.id, c.name FROM classes c JOIN coordinators co ON co.school_id = c.school_id
       WHERE co.user_id = $1 AND c.active ORDER BY c.name ASC`,
      [session.userId]
    );
  }
  return <LabMonitor classes={classes} isAdmin={session.role === "admin"} />;
}
