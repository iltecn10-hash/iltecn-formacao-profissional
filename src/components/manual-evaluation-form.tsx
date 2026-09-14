"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Formulário de avaliação manual do professor (Fase 9.6). Só aparece na
 * página de staff, para um trabalho já entregue (`submitted_at` setado —
 * o backend também garante essa regra em `recordManualEvaluation`).
 * Ao enviar, o trabalho muda de status (APPROVED ou RETURNED) no servidor;
 * `router.refresh()` recarrega a página para refletir o novo status e a
 * nova avaliação na lista, sem precisar duplicar esse estado no cliente.
 */
export function ManualEvaluationForm({ workId }: { workId: string }) {
  const router = useRouter();
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(passed: boolean) {
    if (sending) return;
    setSending(true);
    setError(null);

    const scoreNum = score.trim() === "" ? undefined : Number(score);
    if (scoreNum !== undefined && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100)) {
      setError("A nota deve ser um número entre 0 e 100.");
      setSending(false);
      return;
    }

    try {
      const res = await fetch(`/api/student-works/${workId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passed,
          score: scoreNum,
          feedback: feedback.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível registrar a avaliação.");
        return;
      }
      setScore("");
      setFeedback("");
      router.refresh();
    } catch {
      setError("Não foi possível registrar a avaliação.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground">Avaliar trabalho</h3>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Nota (0 a 100, opcional)</span>
        <input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-32 rounded-md border border-border bg-background px-3 py-1.5 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Feedback para o aluno (opcional)</span>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary"
        />
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={sending}
          className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Aprovar
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={sending}
          className="rounded-md border border-border px-3.5 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
        >
          Devolver para revisão
        </button>
      </div>
    </div>
  );
}
