"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { CompleteLessonResult, LabLessonDetail, SubmitActivityResult } from "@/modules/lab/queries";
import { EmbeddedVideoPlayer } from "@/components/embedded-video-player";
import { MissionStepRow } from "@/components/mission-step-row";
import { ActivityRunner } from "./activity-runner";
import { Lia, LIA_MESSAGES } from "./lia";
import { chip, primaryBtn, softBtn } from "./ui";

type Stage = "aprender" | "ver" | "praticar" | "desafiar" | "conquistar";
const STAGE_LABEL: Record<Stage, string> = {
  aprender: "1. Aprender",
  ver: "2. Ver",
  praticar: "3. Praticar",
  desafiar: "4. Desafiar",
  conquistar: "5. Conquistar",
};

export function LessonPlayer({ lesson }: { lesson: LabLessonDetail }) {
  const router = useRouter();
  const practice = lesson.activities.filter((a) => a.category !== "challenge");
  const challenge = lesson.activities.filter((a) => a.category === "challenge");
  const stages = useMemo<Stage[]>(
    () => ["aprender", "ver", ...(practice.length ? (["praticar"] as Stage[]) : []), ...(challenge.length ? (["desafiar"] as Stage[]) : []), "conquistar"],
    [practice.length, challenge.length]
  );
  const [stage, setStage] = useState<Stage>(lesson.state === "done" ? "conquistar" : "aprender");
  const [done, setDone] = useState<Set<string>>(new Set(lesson.activities.filter((a) => a.completed).map((a) => a.id)));
  const [xpGained, setXpGained] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [openingWork, setOpeningWork] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<CompleteLessonResult | null>(null);

  const onResult = useCallback((id: string, r: SubmitActivityResult) => {
    if (r.correct) setDone((d) => new Set(d).add(id));
    if (r.xpAwarded) setXpGained((x) => x + r.xpAwarded);
  }, []);

  const total = lesson.activities.length;
  const doneCount = lesson.activities.filter((a) => done.has(a.id)).length;
  const allDone = doneCount === total;
  const idx = stages.indexOf(stage);
  const lia: Record<Stage, string> = {
    aprender: LIA_MESSAGES.learn,
    ver: LIA_MESSAGES.watch,
    praticar: LIA_MESSAGES.practice,
    desafiar: LIA_MESSAGES.challenge,
    conquistar: LIA_MESSAGES.conquer,
  };

  async function openWork() {
    if (!lesson.workConfig) return;
    setOpeningWork(true);
    setError(null);
    const res = await fetch("/api/student-works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionId: lesson.id,
        workType: lesson.workConfig.workType,
        templateKey: lesson.workConfig.templateKey ?? undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setOpeningWork(false);
    if (!res.ok) return setError(data.error ?? "Não consegui abrir o seu trabalho.");
    router.push(`/dashboard/trabalhos/${lesson.workConfig.workType === "DOCUMENT" ? "documento" : "planilha"}/${data.work.id}`);
  }

  async function complete() {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/lab/lessons/${lesson.id}/complete`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Não foi possível concluir agora.");
      setFinished(data.result);
      router.refresh();
    } catch {
      setError("Sem conexão agora. Tente de novo em instantes.");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/dashboard/lab" className="text-sm font-semibold text-primary underline">← Voltar ao meu painel</Link>
        <p className="mt-3 text-sm font-semibold text-muted">{lesson.moduleName} · Aula {lesson.number} de 30</p>
        <h1 className="font-heading text-3xl font-bold text-foreground">{lesson.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {lesson.estimatedMinutes ? <span className={chip}>⏱ {lesson.estimatedMinutes} min</span> : null}
          <span className={chip}>🎯 {doneCount}/{total} atividades</span>
          {xpGained > 0 && <span className={chip}>⭐ +{xpGained} XP agora</span>}
        </div>
      </header>

      <nav aria-label="Etapas da aula" className="flex flex-wrap gap-2">
        {stages.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            aria-current={stage === s ? "step" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${stage === s ? "bg-primary text-white" : "bg-surface text-muted border-2 border-border hover:border-primary"}`}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </nav>

      <Lia text={lia[stage]} />

      {stage === "aprender" && (
        <section className="rounded-3xl border-2 border-border bg-surface p-6">
          {lesson.context && <p className="text-xl leading-relaxed text-foreground">{lesson.context}</p>}
          {lesson.objective && (
            <p className="mt-4 rounded-2xl bg-accent-light px-4 py-3 text-base font-semibold">🎯 Nesta aula você vai: {lesson.objective}</p>
          )}
        </section>
      )}

      {stage === "ver" && (
        <section className="space-y-4 rounded-3xl border-2 border-border bg-surface p-6">
          {lesson.video && lesson.video.active && <EmbeddedVideoPlayer video={lesson.video} />}
          <h2 className="font-heading text-xl font-bold">Passo a passo</h2>
          {lesson.steps.length === 0 && <p className="text-muted">Esta aula não tem passos escritos.</p>}
          <div className="flex flex-col gap-3 text-base">
            {lesson.steps.map((t, i) => (
              <MissionStepRow key={t.id} index={i + 1} task={t} />
            ))}
          </div>
        </section>
      )}

      {stage === "praticar" && practice.map((a) => <ActivityRunner key={a.id} activity={{ ...a, completed: done.has(a.id) }} onResult={onResult} />)}
      {stage === "desafiar" && challenge.map((a) => <ActivityRunner key={a.id} activity={{ ...a, completed: done.has(a.id) }} onResult={onResult} />)}

      {stage === "conquistar" && (
        <section className="space-y-4 rounded-3xl border-2 border-border bg-surface p-6">
          <h2 className="font-heading text-2xl font-bold">Conquistar a aula 🏆</h2>
          <p className="text-base text-muted">
            {allDone ? "Todas as atividades estão feitas." : `Faltam ${total - doneCount} atividade(s) nas etapas de praticar e desafiar.`}
          </p>

          {lesson.workConfig && (
            <div className="rounded-2xl bg-accent-light p-4">
              <p className="text-base font-semibold">
                📄 Esta aula tem um trabalho para entregar {lesson.workSubmitted ? "— já entregue ✅" : "— ainda não entregue"}.
              </p>
              {!lesson.workSubmitted && (
                <button type="button" onClick={openWork} disabled={openingWork} className={`${primaryBtn} mt-3`}>
                  {openingWork ? "Abrindo…" : "Abrir meu trabalho"}
                </button>
              )}
            </div>
          )}

          {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-base font-semibold text-danger">{error}</p>}

          {!finished && lesson.state !== "done" && (
            <button type="button" onClick={complete} disabled={completing || !allDone} className={primaryBtn}>
              {completing ? "Concluindo…" : "Concluir aula"}
            </button>
          )}

          {(finished || lesson.state === "done") && (
            <div className="space-y-3" aria-live="polite">
              <Lia text={LIA_MESSAGES.done} />
              {finished && finished.pointsAwarded > 0 && <p className="text-lg font-bold text-primary">⭐ +{finished.pointsAwarded} XP pela aula!</p>}
              {finished?.newAchievements.map((a) => (
                <p key={a.name} className="rounded-2xl bg-accent-light px-4 py-3 text-base font-bold">🏅 Nova medalha: {a.icon} {a.name}</p>
              ))}
              {finished?.certificate && (
                <Link href="/dashboard/lab/certificado" className={`${primaryBtn} inline-block`}>🎓 Ver meu certificado</Link>
              )}
              {(finished?.nextLessonId ?? lesson.nextLessonId) && (
                <Link href={`/dashboard/lab/aula/${finished?.nextLessonId ?? lesson.nextLessonId}`} className={`${primaryBtn} inline-block`}>
                  Próxima aula →
                </Link>
              )}
              <Link href="/dashboard/lab" className={`${softBtn} inline-block`}>Voltar ao painel</Link>
            </div>
          )}
        </section>
      )}

      <div className="flex justify-between">
        <button type="button" disabled={idx <= 0} onClick={() => setStage(stages[idx - 1])} className={softBtn}>← Voltar</button>
        <button type="button" disabled={idx >= stages.length - 1} onClick={() => setStage(stages[idx + 1])} className={primaryBtn}>Continuar →</button>
      </div>
    </div>
  );
}
