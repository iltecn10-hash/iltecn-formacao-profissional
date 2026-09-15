"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { VideoProvider, VideoType } from "@/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const VIDEO_TYPE_OPTIONS: { value: VideoType; label: string }[] = [
  { value: "EXPLICATIVO", label: "Explicativo" },
  { value: "DEMONSTRATIVO", label: "Demonstrativo" },
  { value: "EXEMPLO", label: "Exemplo" },
  { value: "ORIENTACAO", label: "Orientação" },
];

// Só YOUTUBE e (desde a Fase 10.5) INTERNAL/CLOUD_STORAGE têm player embutido no
// simulador — VIMEO ainda cai para um link simples até ganhar um transformador de
// URL de embed como o do YouTube.
const PROVIDER_OPTIONS: { value: VideoProvider; label: string }[] = [
  { value: "YOUTUBE", label: "YouTube" },
  { value: "VIMEO", label: "Vimeo (ainda sem player embutido — abre em link)" },
  { value: "CLOUD_STORAGE", label: "Armazenamento próprio (arquivo direto, com player embutido)" },
  { value: "INTERNAL", label: "Interno (arquivo servido pelo próprio site, com player embutido)" },
];

export interface VideoLike {
  title: string;
  description: string | null;
  video_url: string;
  duration_seconds: number | null;
  provider: VideoProvider;
  video_type: VideoType;
  active: boolean;
}

/**
 * Formulário de vídeo genérico (extraído na Fase 10.5 de `MissionTaskVideoForm`,
 * Fase 10.3): o mesmo formulário serve tanto para o vídeo de uma etapa quanto
 * para o vídeo da missão como um todo — a única diferença entre os dois é o
 * endpoint da API para onde o PUT/DELETE vai. Sempre um upsert: só existe um
 * vídeo por vez em cada endpoint (etapa ou missão).
 */
export function VideoUpsertForm({
  endpoint,
  existing,
  onDone,
}: {
  endpoint: string;
  existing: VideoLike | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(existing?.video_url ?? "");
  const [durationSeconds, setDurationSeconds] = useState(
    existing?.duration_seconds != null ? String(existing.duration_seconds) : ""
  );
  const [provider, setProvider] = useState<VideoProvider>(existing?.provider ?? "YOUTUBE");
  const [videoType, setVideoType] = useState<VideoType>(existing?.video_type ?? "DEMONSTRATIVO");
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description.trim() || undefined,
        videoUrl,
        durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
        provider,
        videoType,
        active,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível salvar o vídeo.");
      return;
    }
    router.refresh();
    onDone();
  }

  async function handleDelete() {
    if (loading) return;
    setLoading(true);
    await fetch(endpoint, { method: "DELETE" });
    setLoading(false);
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3 rounded-md border border-border bg-background p-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Título</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Descrição (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">URL do vídeo</label>
        <input
          required
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Duração (segundos)</label>
          <input
            type="number"
            min={1}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Tipo de vídeo</label>
          <select value={videoType} onChange={(e) => setVideoType(e.target.value as VideoType)} className={inputClass}>
            {VIDEO_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Provedor</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value as VideoProvider)} className={inputClass}>
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Vídeo ativo (aparece para os alunos)
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Salvando…" : existing ? "Salvar alterações" : "Adicionar vídeo"}
        </button>
        {existing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-md border border-danger px-3.5 py-1.5 text-sm font-medium text-danger disabled:opacity-50"
          >
            Remover vídeo
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          disabled={loading}
          className="rounded-md border border-border px-3.5 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
