"use client";

import { useCallback, useState } from "react";
import type { ActivityKind, PublicConfig } from "@/lib/lab/activities";
import type { LabActivityView, SubmitActivityResult } from "@/modules/lab/queries";
import { Lia, LIA_MESSAGES } from "./lia";
import { primaryBtn, softBtn, chip } from "./ui";
import { ChoiceActivity, DragActivity, MatchActivity, OrderActivity, TypeActivity } from "./basic-activities";
import { DesktopActivity, DrawActivity, FilesActivity, GestureActivity } from "./sim-activities";

type Cfg = Record<string, unknown>;

/** Renderiza a interação de um tipo de atividade. Também é usado pela Central de Jogos. */
export function Interactive({
  activity,
  disabled,
  onSubmit,
}: {
  activity: { kind: ActivityKind; config: PublicConfig };
  disabled: boolean;
  onSubmit: (s: unknown) => void;
}) {
  const props = { config: activity.config as never, disabled, onSubmit };
  switch (activity.kind) {
    case "choice":
      return <ChoiceActivity {...props} />;
    case "match":
      return <MatchActivity {...props} />;
    case "order":
      return <OrderActivity {...props} />;
    case "drag":
      return <DragActivity {...props} />;
    case "type":
      return <TypeActivity {...props} />;
    case "files":
      return <FilesActivity {...props} />;
    case "gesture":
      return <GestureActivity {...props} />;
    case "draw":
      return <DrawActivity {...props} />;
    case "desktop":
      return <DesktopActivity {...props} />;
  }
}

/**
 * Uma atividade: mostra o enunciado, envia a resposta ao SERVIDOR (que corrige),
 * mostra o retorno positivo e deixa tentar de novo quantas vezes quiser.
 */
export function ActivityRunner({
  activity,
  onResult,
}: {
  activity: LabActivityView;
  onResult: (activityId: string, result: SubmitActivityResult) => void;
}) {
  const [result, setResult] = useState<SubmitActivityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [round, setRound] = useState(0);
  const hint = (activity.config as Cfg).hint as string | undefined;

  const submit = useCallback(
    async (submission: unknown) => {
      setSending(true);
      setError(null);
      try {
        const res = await fetch(`/api/lab/activities/${activity.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Algo deu errado. Tente de novo.");
          return;
        }
        setResult(data.result);
        onResult(activity.id, data.result);
      } catch {
        setError("Sem conexão agora. Verifique a internet e tente de novo.");
      } finally {
        setSending(false);
      }
    },
    [activity.id, onResult]
  );

  const finished = result?.correct || activity.completed;

  return (
    <section aria-labelledby={`t-${activity.id}`} className="rounded-3xl border-2 border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`t-${activity.id}`} className="font-heading text-xl font-bold text-foreground">
          {activity.title}
        </h3>
        <span className={chip}>+{activity.xp} XP</span>
        {activity.completed && <span className={chip}>✅ Feito</span>}
      </div>
      <p className="mt-2 text-base text-muted">{activity.prompt}</p>

      <div className="mt-5" key={round}>
        <Interactive activity={activity} disabled={sending || Boolean(result?.correct)} onSubmit={submit} />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-base font-semibold text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 space-y-3" aria-live="polite">
          <Lia text={result.correct ? result.feedback : `${result.feedback} ${LIA_MESSAGES.tryAgain}`} />
          {result.correct && result.xpAwarded > 0 && (
            <p className="text-lg font-bold text-primary">⭐ +{result.xpAwarded} XP — {result.level.emoji} {result.level.name}</p>
          )}
          {result.correct && result.alreadyCompleted && <p className="text-sm text-muted">Você já tinha feito esta. Praticar de novo faz bem!</p>}
          {result.newAchievements.map((a) => (
            <p key={a.name} className="rounded-2xl bg-accent-light px-4 py-3 text-base font-bold text-foreground">
              🏅 Nova medalha: {a.icon} {a.name}
            </p>
          ))}
          {!result.correct && (
            <>
              {hint && result.attempts >= 2 && (
                <p className="rounded-2xl bg-accent-light px-4 py-3 text-base">💡 {LIA_MESSAGES.hint}{hint}</p>
              )}
              <button
                type="button"
                className={primaryBtn}
                onClick={() => {
                  setResult(null);
                  setRound((r) => r + 1);
                }}
              >
                Tentar de novo
              </button>
            </>
          )}
          {result.correct && (
            <button type="button" className={softBtn} onClick={() => { setResult(null); setRound((r) => r + 1); }}>
              Praticar de novo
            </button>
          )}
        </div>
      )}
      {!result && activity.completed && !finished && null}
    </section>
  );
}
