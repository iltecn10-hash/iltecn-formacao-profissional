import Link from "next/link";
import type { LabOverview, LessonState } from "@/modules/lab/queries";
import { SKILL_LABELS } from "@/lib/lab/activities";
import { KIDS_LEVELS } from "@/lib/levels";
import { Lia, LIA_MESSAGES } from "./lia";
import { primaryBtn } from "./ui";

const STATE_LABEL: Record<LessonState, { icon: string; text: string }> = {
  locked: { icon: "🔒", text: "Bloqueada" },
  available: { icon: "▶️", text: "Pode começar" },
  in_progress: { icon: "✏️", text: "Em andamento" },
  done: { icon: "✅", text: "Concluída" },
};

function Bar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-4 w-full overflow-hidden rounded-full bg-border"
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function StudentOverview({ data, firstName }: { data: LabOverview; firstName: string }) {
  const percent = Math.round((data.lessonsDone / Math.max(1, data.lessonsTotal)) * 100);
  const modules = new Map<string, typeof data.lessons>();
  for (const l of data.lessons) modules.set(l.moduleName, [...(modules.get(l.moduleName) ?? []), l]);
  const next = data.nextLesson;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">ILTECN LAB</p>
        <h1 className="font-heading text-3xl font-bold text-foreground">Olá, {firstName}! 👋</h1>
        <p className="mt-1 text-muted">{data.trackName.replace("ILTECN LAB — ", "")}</p>
      </header>

      <Lia text={data.lessonsDone === 0 ? LIA_MESSAGES.welcome : "Que bom te ver de novo! Vamos continuar de onde você parou?"} />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Meu progresso">
        <div className="rounded-3xl border-2 border-border bg-surface p-5">
          <p className="text-sm font-semibold text-muted">Aulas</p>
          <p className="font-heading text-4xl font-bold">{data.lessonsDone}<span className="text-xl text-muted"> / {data.lessonsTotal}</span></p>
          <div className="mt-3"><Bar percent={percent} label="Progresso das aulas" /></div>
        </div>
        <div className="rounded-3xl border-2 border-border bg-surface p-5">
          <p className="text-sm font-semibold text-muted">Meu XP</p>
          <p className="font-heading text-4xl font-bold">⭐ {data.student.points}</p>
          <p className="mt-1 text-sm text-muted">
            {data.level.xpToNext !== null ? `Faltam ${data.level.xpToNext} XP para ${data.level.nextName}` : "Você chegou ao nível máximo!"}
          </p>
        </div>
        <div className="rounded-3xl border-2 border-border bg-surface p-5">
          <p className="text-sm font-semibold text-muted">Meu nível</p>
          <p className="font-heading text-3xl font-bold">{data.level.emoji} {data.level.name}</p>
          <p className="mt-1 text-sm text-muted">Nível {data.level.index + 1} de {KIDS_LEVELS.length}</p>
        </div>
      </section>

      {next && (
        <section className="rounded-3xl bg-primary p-6 text-white">
          <p className="text-sm font-semibold opacity-90">Próxima aula</p>
          <h2 className="font-heading text-2xl font-bold">Aula {next.number}: {next.title}</h2>
          <Link href={`/dashboard/lab/aula/${next.id}`} className={`${primaryBtn} mt-4 inline-block !bg-white !text-primary-dark hover:!bg-accent-light`}>
            {next.state === "in_progress" ? "Continuar" : "Começar"} →
          </Link>
        </section>
      )}

      {data.certificate && (
        <Link href="/dashboard/lab/certificado" className="block rounded-3xl border-2 border-accent bg-accent-light p-5 text-lg font-bold">
          🎓 Seu certificado está pronto! Toque para ver.
        </Link>
      )}

      <section aria-labelledby="skills">
        <h2 id="skills" className="font-heading text-xl font-bold">Minhas habilidades</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.skills.map((s) => (
            <li key={s.skill} className="rounded-2xl border-2 border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{SKILL_LABELS[s.skill].emoji} {SKILL_LABELS[s.skill].label}</span>
                <span className="text-sm font-bold">{s.percent}%</span>
              </div>
              <div className="mt-2"><Bar percent={s.percent} label={SKILL_LABELS[s.skill].label} /></div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="medals">
        <h2 id="medals" className="font-heading text-xl font-bold">Minhas medalhas</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.achievements.map((a) => (
            <li key={a.id} className={`rounded-2xl border-2 p-4 text-center ${a.earned_at ? "border-accent bg-accent-light" : "border-border bg-surface opacity-60"}`}>
              <p className="text-4xl" aria-hidden>{a.earned_at ? a.icon : "🔒"}</p>
              <p className="mt-1 text-sm font-bold">{a.name}</p>
              <p className="text-xs text-muted">{a.earned_at ? "Conquistada!" : a.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lessons">
        <h2 id="lessons" className="font-heading text-xl font-bold">Todas as aulas</h2>
        <div className="mt-3 space-y-6">
          {[...modules.entries()].map(([name, lessons]) => (
            <div key={name}>
              <h3 className="font-heading text-lg font-semibold text-primary-dark">{name}</h3>
              <ul className="mt-2 grid gap-2">
                {lessons.map((l) => {
                  const st = STATE_LABEL[l.state];
                  const inner = (
                    <>
                      <span className="text-2xl" aria-hidden>{st.icon}</span>
                      <span className="flex-1">
                        <span className="block text-base font-bold">Aula {l.number}: {l.title}</span>
                        <span className="text-sm text-muted">{st.text} · {l.activitiesDone}/{l.activitiesTotal} atividades</span>
                      </span>
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {l.state === "locked" ? (
                        <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface p-4 opacity-60" aria-disabled="true">{inner}</div>
                      ) : (
                        <Link href={`/dashboard/lab/aula/${l.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface p-4 transition hover:border-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50">
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border-2 border-border bg-surface p-5">
        <h2 className="font-heading text-xl font-bold">Minha avaliação</h2>
        <p className="mt-1 text-3xl font-bold">{data.evaluation.score} <span className="text-lg text-primary-dark">— {data.evaluation.label}</span></p>
        <p className="mt-1 text-sm text-muted">Conhecimento {data.evaluation.parts.knowledge ?? "—"} · Prática {data.evaluation.parts.practice ?? "—"} · Projeto {data.evaluation.parts.project ?? "—"}. Pode refazer qualquer atividade para melhorar!</p>
      </section>
    </div>
  );
}
