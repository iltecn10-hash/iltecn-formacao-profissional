"use client";

import { useState } from "react";

export function ResetPasswordButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm(`Gerar uma nova senha provisória para ${studentName}? A senha atual deixa de funcionar.`)) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/students/${studentId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível redefinir a senha.");
      } else {
        setResult(data.temporaryPassword as string);
      }
    } catch {
      setError("Sem conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-60"
      >
        {loading ? "Gerando…" : "Redefinir senha"}
      </button>
      {result && (
        <span className="text-xs text-foreground">
          Nova senha: <strong className="select-all font-mono">{result}</strong>{" "}
          <span className="text-muted">(anote agora, não será mostrada de novo)</span>
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
