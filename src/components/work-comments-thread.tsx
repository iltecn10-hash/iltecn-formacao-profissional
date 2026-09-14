"use client";

import { useEffect, useState } from "react";
import type { WorkComment } from "@/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Conversa entre aluno e professor sobre um trabalho (Fase 9.6). Usado sem
 * alteração tanto no editor do aluno quanto na página de staff — a autoria
 * de cada comentário vem do lado do servidor (sessão), então o mesmo
 * componente funciona para os dois papéis.
 */
export function WorkCommentsThread({ workId }: { workId: string }) {
  const [comments, setComments] = useState<WorkComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/student-works/${workId}/comments`)
      .then((res) => (res.ok ? res.json() : { comments: [] }))
      .then((data) => {
        if (!cancelled) setComments(data.comments ?? []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/student-works/${workId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível enviar o comentário.");
        return;
      }
      setComments((prev) => [...(prev ?? []), data.comment]);
      setDraft("");
    } catch {
      setError("Não foi possível enviar o comentário.");
    } finally {
      setSending(false);
    }
  }

  if (!comments) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 print:hidden">
      <h3 className="text-sm font-medium text-foreground">Comentários</h3>

      {comments.length > 0 && (
        <div className="flex flex-col gap-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{c.author_name ?? "Usuário"}</span>
                <span className="text-xs text-muted">{formatDateTime(c.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || draft.trim().length === 0}
          className="self-start rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Comentar"}
        </button>
      </div>
    </div>
  );
}
