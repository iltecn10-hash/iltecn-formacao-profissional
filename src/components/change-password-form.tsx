"use client";

import { useState } from "react";

export function ChangePasswordForm({ isStudent }: { isStudent: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("A confirmação não é igual à nova senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível alterar a senha.");
      } else {
        setDone(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setError("Sem conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium text-foreground">
        Senha atual
        <input
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="field mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-foreground">
        Nova senha
        <input
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="field mt-1"
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          {isStudent
            ? "Pelo menos 6 caracteres."
            : "Pelo menos 8 caracteres, com letras e números."}
        </span>
      </label>
      <label className="block text-sm font-medium text-foreground">
        Repita a nova senha
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="field mt-1"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-success-light px-3 py-2 text-sm text-success">
          Senha alterada com sucesso.
        </p>
      )}
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? "Salvando…" : "Alterar senha"}
      </button>
    </form>
  );
}
