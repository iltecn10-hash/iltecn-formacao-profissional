import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { listAchievementsForStudent } from "@/modules/achievements/queries";

export default async function ConquistasPage() {
  const session = await getSession();
  if (!session || session.role !== "student") {
    redirect("/dashboard");
  }

  const studentId = await getStudentIdByUserId(session.userId);
  const achievements = studentId ? await listAchievementsForStudent(studentId) : [];
  const earnedCount = achievements.filter((a) => a.earned_at).length;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Conquistas</h1>
      <p className="mt-1 text-muted">
        {earnedCount} de {achievements.length} conquistadas. Cada uma marca um avanço na sua
        formação — não é uma disputa com os colegas.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((a) => {
          const earned = !!a.earned_at;
          return (
            <div
              key={a.id}
              className={`rounded-lg border p-5 ${
                earned ? "border-primary bg-primary-light" : "border-border bg-surface opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <h3 className="font-heading font-semibold text-foreground">{a.name}</h3>
                  {a.description && (
                    <p className="mt-1 text-sm text-muted">{a.description}</p>
                  )}
                  {earned && a.earned_at && (
                    <p className="mt-2 text-xs font-medium text-primary-dark">
                      Conquistada em{" "}
                      {new Date(a.earned_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
