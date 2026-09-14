"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Track } from "@/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ModuleForm({ tracks }: { tracks: Track[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!trackId) {
      setError("Crie uma trilha antes de adicionar módulos.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, trackId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta operação.");
      setLoading(false);
      return;
    }

    setName("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Trilha
        </label>
        <select
          required
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
          className={inputClass}
        >
          {tracks.length === 0 && <option value="">Nenhuma trilha cadastrada</option>}
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Nome do módulo
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Formatação de Documentos"
          className={inputClass}
        />
      </div>
      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Criar módulo"}
      </button>
    </form>
  );
}
