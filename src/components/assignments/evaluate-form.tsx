"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EvaluateSubmissionForm({
  submissionId,
  maxScore,
  initialScore,
  initialFeedback,
}: {
  submissionId: string;
  maxScore: number;
  initialScore: number | null;
  initialFeedback: string | null;
}) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore == null ? "" : String(initialScore));
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send(status: "evaluated" | "returned") {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/assignments/submissions/${submissionId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        score: score.trim() === "" ? null : Number(score.replace(",", ".")),
        feedback: feedback.trim() === "" ? null : feedback,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível salvar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nota (0 a {maxScore})</label>
          <input
            inputMode="decimal"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="field w-28"
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">Comentário para o aluno</label>
          <input value={feedback} onChange={(e) => setFeedback(e.target.value)} className="field" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={loading} onClick={() => send("evaluated")} className="btn btn-primary">
          Salvar avaliação
        </button>
        <button disabled={loading} onClick={() => send("returned")} className="btn btn-secondary">
          Devolver para refazer
        </button>
      </div>
    </div>
  );
}
