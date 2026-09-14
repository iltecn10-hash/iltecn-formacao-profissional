import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentIdByUserId } from "@/modules/students/queries";
import { getStudentProgress } from "@/modules/missions/queries";
import { MissionCard } from "@/components/mission-card";

export default async function MissoesPage() {
  const session = await getSession();
  if (!session || session.role !== "student") {
    redirect("/dashboard");
  }

  const studentId = await getStudentIdByUserId(session.userId);
  const tracks = studentId ? await getStudentProgress(studentId) : [];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Missões</h1>
      <p className="mt-1 text-muted">
        Situações profissionais reais para você praticar e evoluir.
      </p>

      <div className="mt-8 flex flex-col gap-10">
        {tracks.map((track) => (
          <div key={track.id}>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {track.name}
            </h2>
            {track.description && (
              <p className="mt-1 text-sm text-muted">{track.description}</p>
            )}

            <div className="mt-4 flex flex-col gap-6">
              {track.modules.map((mod) => (
                <div key={mod.id}>
                  <h3 className="text-sm font-semibold text-muted">{mod.name}</h3>
                  <div className="mt-3 flex flex-col gap-3">
                    {mod.missions.length === 0 && (
                      <p className="text-sm text-muted">
                        Nenhuma missão cadastrada neste módulo ainda.
                      </p>
                    )}
                    {mod.missions.map((mission) => (
                      <MissionCard
                        key={mission.id}
                        id={mission.id}
                        title={mission.title}
                        context={mission.context}
                        objective={mission.objective}
                        pointsValue={mission.points_value}
                        competencies={mission.competencies}
                        status={mission.status}
                        resourceUrl={mission.resource_url}
                        submissionUrl={mission.submission_url}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {tracks.length === 0 && (
          <p className="text-sm text-muted">
            Ainda não há trilhas configuradas na plataforma.
          </p>
        )}
      </div>
    </div>
  );
}
