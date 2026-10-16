"use client";

import { useState } from "react";

export function UserResetButton({ userId, userName }: { userId: string; userName: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm(`Gerar uma nova senha provisória para ${userName}? A senha atual deixa de funcionar.`)) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Não foi possível redefinir a senha.");
      else setResult(data.temporaryPassword as string);
    } catch {
      setError("Sem conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={handleClick} disabled={loading} className="btn btn-secondary">
        {loading ? "Gerando…" : "Redefinir senha"}
      </button>
      {result && (
        <span className="text-xs text-foreground">
          Nova senha: <strong className="select-all font-mono">{result}</strong>{" "}
          <span className="text-muted">(anote agora, não será mostrada de novo)</span>
        </span>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
