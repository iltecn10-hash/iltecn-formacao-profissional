"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_TEMPLATES } from "@/lib/document-templates";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function NewDocumentForm({ missions }: { missions: { id: string; title: string }[] }) {
  const router = useRouter();
  const [missionId, setMissionId] = useState(missions[0]?.id ?? "");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!missionId) {
      setError("Escolha uma missão.");
      return;
    }
    setLoading(true);
    const selected = DOCUMENT_TEMPLATES.find((t) => t.key === templateKey);
    const res = await fetch("/api/student-works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionId,
        workType: "DOCUMENT",
        templateKey: templateKey || undefined,
        title: selected ? selected.label : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível criar o documento.");
      return;
    }
    router.push(`/dashboard/trabalhos/documento/${data.work.id}`);
  }

  if (missions.length === 0) {
    return (
      <p className="text-sm text-muted">
        Ainda não há missões cadastradas para vincular um documento.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Missão</label>
        <select
          value={missionId}
          onChange={(e) => setMissionId(e.target.value)}
          className={inputClass}
        >
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Modelo</label>
        <select
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
          className={inputClass}
        >
          <option value="">Documento livre (sem modelo)</option>
          {DOCUMENT_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {loading ? "Criando…" : "Criar documento"}
      </button>
    </form>
  );
}
