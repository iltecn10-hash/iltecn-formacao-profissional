import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  listTracks,
  listAllModules,
  listCompetencies,
} from "@/modules/tracks/queries";
import { listMissionsByModule } from "@/modules/missions/queries";
import { TrackForm } from "@/components/track-form";
import { ModuleForm } from "@/components/module-form";
import { MissionForm } from "@/components/mission-form";

export default async function FormacaoPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  const [tracks, modules, competencies] = await Promise.all([
    listTracks(),
    listAllModules(),
    listCompetencies(),
  ]);

  const missionsByModule = await Promise.all(
    modules.map(async (m) => ({
      module: m,
      missions: await listMissionsByModule(m.id),
    }))
  );

  const trackNameById = Object.fromEntries(tracks.map((t) => [t.id, t.name]));

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Formação</h1>
      <p className="mt-1 text-muted">
        Trilhas, módulos e missões que compõem a formação prática dos alunos.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Nova trilha
          </h2>
          <div className="mt-4">
            <TrackForm />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Novo módulo
          </h2>
          <div className="mt-4">
            <ModuleForm tracks={tracks} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Nova missão
        </h2>
        <div className="mt-4">
          <MissionForm modules={modules} competencies={competencies} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Estrutura atual
        </h2>
        <div className="mt-4 flex flex-col gap-6">
          {missionsByModule.map(({ module: mod, missions }) => (
            <div key={mod.id} className="rounded-lg border border-border bg-surface p-5">
              <p className="text-xs font-medium text-muted">
                {trackNameById[mod.track_id]}
              </p>
              <h3 className="font-heading font-semibold text-foreground">
                {mod.name}
              </h3>
              <ul className="mt-3 flex flex-col gap-1.5">
                {missions.length === 0 && (
                  <li className="text-sm text-muted">Nenhuma missão ainda.</li>
                )}
                {missions.map((mission) => (
                  <li
                    key={mission.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground">{mission.title}</span>
                    <span className="text-muted">{mission.points_value} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
