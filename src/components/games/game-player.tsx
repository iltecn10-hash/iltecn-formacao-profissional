"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Interactive } from "@/components/lab/activity-runner";
import { Lia } from "@/components/lab/lia";
import { primaryBtn, softBtn, chip } from "@/components/lab/ui";
import { DIFFICULTY_LABEL, GAME_TYPE_LABEL, skillLabel, type GameDifficulty, type GameType } from "@/lib/games/engine";
import type { FinishedResult, GameDetail, OpenAttemptView } from "@/lib/games/types";
import type { SubmitChallengeResult } from "@/modules/games/queries";

type ChallengeFeedback = Pick<SubmitChallengeResult, "correct" | "feedback" | "resolved" | "triesLeft" | "points" | "explain">;

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Algo deu errado. Tente de novo." };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Sem conexão agora. Verifique a internet e tente de novo." };
  }
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Stars({ count }: { count: number }) {
  return (
    <p className="game-pop text-5xl" role="img" aria-label={`${count} de 3 estrelas`}>
      {[1, 2, 3].map((n) => (
        <span key={n} aria-hidden>{n <= count ? "⭐" : "☆"}</span>
      ))}
    </p>
  );
}

// ---------------------------------------------------------------- jogador
export function GamePlayer({ game: initial }: { game: GameDetail }) {
  const [game, setGame] = useState(initial);
  const [attempt, setAttempt] = useState<OpenAttemptView | null>(initial.open);
  const [result, setResult] = useState<FinishedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshDetail = useCallback(async () => {
    const r = await api<{ game: GameDetail }>(`/api/games/${game.id}`);
    if (r.ok) setGame(r.data.game);
  }, [game.id]);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await api<{ attempt: OpenAttemptView }>(`/api/games/${game.id}/start`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(null);
    setAttempt(r.data.attempt);
  }

  const finish = useCallback(async () => {
    if (!attempt) return;
    setBusy(true);
    const r = await api<{ result: FinishedResult }>(`/api/games/attempts/${attempt.id}/finish`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setAttempt(null);
    setResult(r.data.result);
    refreshDetail();
  }, [attempt, refreshDetail]);

  if (result) {
    return <ResultScreen game={game} result={result} onRetry={start} busy={busy} error={error} />;
  }
  if (attempt) {
    return (
      <Playing
        game={game}
        attempt={attempt}
        onAttempt={setAttempt}
        onFinish={finish}
        onExpired={(r) => {
          setAttempt(null);
          setResult(r);
          refreshDetail();
        }}
        busy={busy}
        error={error}
      />
    );
  }
  return <StartScreen game={game} onStart={start} busy={busy} error={error} />;
}

// ---------------------------------------------------------------- início
function StartScreen({ game, onStart, busy, error }: { game: GameDetail; onStart: () => void; busy: boolean; error: string | null }) {
  const blocked = game.state === "locked" || game.state === "limit";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/jogos" className="text-sm font-semibold text-primary underline">← Todos os jogos</Link>
      <header className="rounded-3xl border-2 border-border bg-surface p-6 sm:p-8">
        <p className="text-5xl" aria-hidden>🧭</p>
        <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">{game.title}</h1>
        <p className="mt-2 text-lg text-muted">{game.description}</p>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Informações do jogo">
          <li className={chip}>{game.phases} fases</li>
          <li className={chip}>{DIFFICULTY_LABEL[game.difficulty as GameDifficulty] ?? game.difficulty}</li>
          <li className={chip}>{GAME_TYPE_LABEL[game.gameType as GameType] ?? game.gameType}</li>
          <li className={chip}>Passa com {game.passPercent}%</li>
          <li className={chip}>+{game.xpReward} XP</li>
          {game.attemptsLeft !== null && <li className={chip}>{game.attemptsLeft} tentativa(s) restante(s)</li>}
          {game.timeLimitSeconds && <li className={chip}>⏱ {Math.round(game.timeLimitSeconds / 60)} min</li>}
        </ul>
      </header>

      {game.instructions && (
        <section aria-labelledby="como-jogar" className="rounded-3xl border-2 border-border bg-surface p-6">
          <h2 id="como-jogar" className="font-heading text-xl font-bold">Como jogar</h2>
          <p className="mt-2 text-base text-foreground">{game.instructions}</p>
          <p className="mt-3 text-sm text-muted">A nota depende só dos seus acertos — velocidade não vale ponto. Você pode parar e continuar depois.</p>
        </section>
      )}

      {game.completed && (
        <p className="rounded-2xl bg-accent-light px-4 py-3 text-base font-semibold" role="status">
          ✅ Você já concluiu este jogo (melhor nota: {game.bestPercent}%). Jogar de novo é prática — o XP é pago uma vez só.
        </p>
      )}
      {game.last && !game.last.passed && !game.completed && (
        <p className="rounded-2xl bg-primary-light px-4 py-3 text-base font-semibold text-primary-dark" role="status">
          Na última partida você fez {game.last.percent}%. Dá para melhorar — bora de novo?
        </p>
      )}
      {game.lockReason && <p role="alert" className="rounded-2xl bg-accent-light px-4 py-3 text-base font-semibold">🔒 {game.lockReason}</p>}
      {game.state === "limit" && <p role="alert" className="rounded-2xl bg-accent-light px-4 py-3 text-base font-semibold">Você usou todas as tentativas deste jogo. Fale com o seu professor.</p>}
      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-base font-semibold text-danger">{error}</p>}

      <button type="button" className={primaryBtn} disabled={busy || blocked} onClick={onStart}>
        {game.state === "in_progress" ? "Continuar" : game.attempts > 0 ? "Jogar de novo" : "Começar"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- partida
function Playing({
  game, attempt, onAttempt, onFinish, onExpired, busy, error,
}: {
  game: GameDetail;
  attempt: OpenAttemptView;
  onAttempt: (a: OpenAttemptView) => void;
  onFinish: () => void;
  onExpired: (r: FinishedResult) => void;
  busy: boolean;
  error: string | null;
}) {
  const { summary } = attempt;
  // Fase em foco: a primeira ainda não vencida (ou a escolhida, se já estiver aberta).
  const firstOpenIdx = Math.max(0, summary.phases.findIndex((p) => !p.gatePassed));
  const defaultIdx = summary.phases.every((p) => p.gatePassed) ? summary.phases.length - 1 : firstOpenIdx;
  const [picked, setPicked] = useState<number | null>(null);
  const idx = picked !== null && !attempt.phases[picked]?.locked ? picked : defaultIdx;
  const phase = attempt.phases[idx];
  const phaseSum = summary.phases[idx];
  const allDone = summary.phases.every((p) => p.gatePassed);
  const blocked = summary.blockedAtPhase !== null;

  const [feedback, setFeedback] = useState<Record<string, ChallengeFeedback>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  // Cronômetro (só quando o jogo tem limite). O servidor é quem decide quando acabou.
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!attempt.expiresAt) return;
    const end = new Date(attempt.expiresAt).getTime();
    const tick = () => setLeft(Math.round((end - Date.now()) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt.expiresAt]);
  const timeUp = left !== null && left <= 0;
  const expiredSent = useRef(false);
  useEffect(() => {
    if (!timeUp || expiredSent.current) return;
    expiredSent.current = true;
    (async () => {
      const r = await api<{ result: FinishedResult }>(`/api/games/attempts/${attempt.id}/finish`, { method: "POST" });
      if (r.ok) onExpired(r.data.result);
    })();
  }, [timeUp, attempt.id, onExpired]);

  async function answer(challengeId: string, submission: unknown) {
    setLocalError(null);
    const r = await api<{ result: SubmitChallengeResult }>(`/api/games/attempts/${attempt.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, submission }),
    });
    if (!r.ok) return setLocalError(r.error);
    const res = r.data.result;
    if (res.expired) return onExpired(res.expired);
    setFeedback((f) => ({ ...f, [challengeId]: res }));
    if (res.open) onAttempt(res.open);
  }

  const pctDone = Math.round((summary.resolvedCount / Math.max(1, summary.totalChallenges)) * 100);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [idx]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-3xl border-2 border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-xl font-bold">{game.title}</h1>
          <div className="flex gap-2">
            <span className={chip}>⭐ {summary.earned}/{summary.possible} pts</span>
            {left !== null && <span className={chip} role="timer" aria-label={`Tempo restante ${formatClock(left)}`}>⏱ {formatClock(left)}</span>}
          </div>
        </div>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-border"
          role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctDone}
          aria-label={`${summary.resolvedCount} de ${summary.totalChallenges} desafios feitos`}
        >
          <div className="game-bar h-full bg-primary" style={{ width: `${pctDone}%` }} />
        </div>
        <ol className="mt-4 flex flex-wrap gap-2" aria-label="Fases">
          {attempt.phases.map((p, i) => {
            const s = summary.phases[i];
            const state = p.locked ? "bloqueada" : s.gatePassed ? "concluída" : "aberta";
            return (
              <li key={p.id}>
                <button
                  type="button" disabled={p.locked} onClick={() => setPicked(i)}
                  aria-current={i === idx ? "step" : undefined}
                  className={`min-h-11 rounded-full border-2 px-3 py-1 text-sm font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 disabled:opacity-60 ${
                    i === idx ? "border-primary bg-primary text-white" : "border-border bg-surface"
                  }`}
                >
                  <span aria-hidden>{p.locked ? "🔒" : s.gatePassed ? "✅" : (p.emoji ?? "🎯")} </span>
                  {i + 1}. {p.title}<span className="sr-only"> ({state})</span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      {(error || localError) && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-base font-semibold text-danger">{localError ?? error}</p>}

      <section aria-labelledby="fase-titulo" className="space-y-4">
        <div>
          <h2 id="fase-titulo" ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-bold focus:outline-none">
            {phase.emoji} Fase {idx + 1}: {phase.title}
          </h2>
          {phase.description && <p className="text-muted">{phase.description}</p>}
          {phase.minPercent > 0 && <p className="text-sm text-muted">Para abrir a próxima fase: {phase.minPercent}% ou mais nesta.</p>}
        </div>

        {phase.challenges.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            progress={attempt.progress[c.id]}
            feedback={feedback[c.id]}
            kids={game.kids}
            onAnswer={(sub) => answer(c.id, sub)}
          />
        ))}

        {phaseSum.resolved && (
          <div className="game-pop rounded-3xl border-2 border-primary bg-primary-light p-5 text-primary-dark" role="status">
            {phaseSum.gatePassed ? (
              <p className="text-lg font-bold">🎉 Fase concluída com {phaseSum.percent}%!</p>
            ) : (
              <p className="text-lg font-bold">Você fez {phaseSum.percent}% e esta fase pede {phaseSum.minPercent}%. Encerre para ver as orientações e tente outra partida.</p>
            )}
            {phaseSum.gatePassed && idx < attempt.phases.length - 1 && (
              <button type="button" className={`${primaryBtn} mt-3`} onClick={() => setPicked(idx + 1)}>Ir para a próxima fase</button>
            )}
          </div>
        )}
      </section>

      {(allDone || blocked) && (
        <button type="button" className={primaryBtn} disabled={busy} onClick={onFinish}>
          {blocked ? "Encerrar e ver orientações" : "Ver meu resultado"}
        </button>
      )}
    </div>
  );
}

function ChallengeCard({
  challenge, progress, feedback, kids, onAnswer,
}: {
  challenge: OpenAttemptView["phases"][number]["challenges"][number];
  progress?: OpenAttemptView["progress"][string];
  feedback?: ChallengeFeedback;
  kids: boolean;
  onAnswer: (submission: unknown) => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [round, setRound] = useState(0);
  const liveRef = useRef<HTMLDivElement>(null);
  const hint = (challenge.config as { hint?: string }).hint;
  const tries = progress?.tries ?? 0;
  const resolved = Boolean(progress?.resolved);
  const { label, emoji } = skillLabel(challenge.skill);
  const shownFeedback = feedback && !resolved ? feedback : feedback;

  async function submit(sub: unknown) {
    setSending(true);
    await onAnswer(sub);
    setSending(false);
    setTimeout(() => liveRef.current?.focus(), 50);
  }

  return (
    <article aria-labelledby={`c-${challenge.id}`} className="rounded-3xl border-2 border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`c-${challenge.id}`} className="font-heading text-xl font-bold">{challenge.title}</h3>
        <span className={chip}>{emoji} {label}</span>
        <span className={chip}>{challenge.points} pts</span>
        {resolved && progress?.correct && <span className={chip}>✅ Acertou ({progress.points} pts)</span>}
        {resolved && !progress?.correct && <span className={chip}>Tentativas acabaram</span>}
      </div>
      <p className="mt-2 text-base text-muted">{challenge.prompt}</p>
      {!resolved && <p className="mt-1 text-sm text-muted">Tentativa {Math.min(tries + 1, challenge.maxTries)} de {challenge.maxTries}</p>}

      {!resolved && (
        <div className="mt-4" key={round}>
          <Interactive activity={{ kind: challenge.kind, config: challenge.config }} disabled={sending} onSubmit={submit} />
        </div>
      )}

      <div ref={liveRef} tabIndex={-1} aria-live="polite" className="mt-4 space-y-3 focus:outline-none">
        {shownFeedback && (
          kids ? (
            <Lia text={shownFeedback.feedback} />
          ) : (
            <p className={`rounded-2xl px-4 py-3 text-base font-semibold ${shownFeedback.correct ? "bg-primary-light text-primary-dark" : "bg-accent-light text-foreground"}`}>
              {shownFeedback.correct ? "✔ " : "↻ "}{shownFeedback.feedback}
            </p>
          )
        )}
        {!resolved && tries > 0 && hint && <p className="rounded-2xl bg-accent-light px-4 py-3 text-base">💡 Dica: {hint}</p>}
        {!resolved && tries > 0 && (
          <button type="button" className={softBtn} onClick={() => setRound((r) => r + 1)}>Tentar de novo</button>
        )}
        {resolved && progress?.explain && <p className="rounded-2xl border-2 border-border px-4 py-3 text-base">📖 {progress.explain}</p>}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- resultado
function ResultScreen({ game, result, onRetry, busy, error }: { game: GameDetail; result: FinishedResult; onRetry: () => void; busy: boolean; error: string | null }) {
  const canRetry = game.state !== "limit" && (game.attemptsLeft === null || game.attemptsLeft > 0);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section aria-labelledby="resultado" className="rounded-3xl border-2 border-border bg-surface p-6 text-center sm:p-8">
        <h1 id="resultado" className="font-heading text-3xl font-bold">
          {result.passed ? (game.kids ? "Você conseguiu! 🎉" : "Jogo concluído! 🎉") : result.endedReason === "time" ? "O tempo acabou ⏱" : "Quase lá! 💪"}
        </h1>
        <div className="mt-3 flex justify-center"><Stars count={result.stars} /></div>
        <p className="mt-3 text-4xl font-bold text-primary">{result.percent}%</p>
        <p className="text-muted">{result.points} de {result.pointsPossible} pontos · {result.correctCount} acertos · {result.wrongCount} tentativas erradas</p>
        {result.xpAwarded > 0 && <p className="game-pop mt-3 text-xl font-bold text-primary">⭐ +{result.xpAwarded} XP</p>}
        {result.passed && result.xpAwarded === 0 && <p className="mt-3 text-sm text-muted">O XP deste jogo já tinha sido ganho antes. Praticar de novo faz bem!</p>}
        {result.missionCompleted && <p className="mt-3 text-base font-bold text-primary">✅ A missão ligada a este jogo foi concluída.</p>}
        {result.newAchievements.map((a) => (
          <p key={a.name} className="game-pop mt-3 rounded-2xl bg-accent-light px-4 py-3 text-base font-bold">🏅 Nova medalha: {a.icon} {a.name}</p>
        ))}
      </section>

      {result.guidance && (
        <section aria-labelledby="orient" className="rounded-3xl border-2 border-border bg-surface p-6">
          <h2 id="orient" className="font-heading text-xl font-bold">{result.guidance.title}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base">
            {result.guidance.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="habs" className="rounded-3xl border-2 border-border bg-surface p-6">
        <h2 id="habs" className="font-heading text-xl font-bold">Suas habilidades neste jogo</h2>
        <ul className="mt-3 space-y-3">
          {result.summary.skills.map((s) => {
            const l = skillLabel(s.skill);
            const status = s.percent >= 80 ? "ótimo" : s.percent >= 60 ? "bom, dá para melhorar" : "vale praticar mais";
            return (
              <li key={s.skill}>
                <div className="flex justify-between text-base font-semibold"><span>{l.emoji} {l.label}</span><span>{s.percent}% — {status}</span></div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-border" aria-hidden><div className="h-full bg-primary" style={{ width: `${s.percent}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </section>

      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-base font-semibold text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {canRetry && <button type="button" className={primaryBtn} disabled={busy} onClick={onRetry}>{result.passed ? "Jogar de novo" : "Tentar de novo"}</button>}
        <Link href="/dashboard/jogos" className={`${softBtn} inline-flex items-center`}>Voltar aos jogos</Link>
      </div>
    </div>
  );
}
