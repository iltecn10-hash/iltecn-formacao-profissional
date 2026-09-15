"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MissionTaskWithVideo, VideoProvider, VideoType } from "@/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const VIDEO_TYPE_OPTIONS: { value: VideoType; label: string }[] = [
  { value: "EXPLICATIVO", label: "Explicativo" },
  { value: "DEMONSTRATIVO", label: "Demonstrativo" },
  { value: "EXEMPLO", label: "Exemplo" },
  { value: "ORIENTACAO", label: "Orientação" },
];

// Só YOUTUBE tem player embutido no simulador (Fase 10.2, decisão do usuário) — os
// demais já ficam disponíveis aqui (arquitetura do item 10 do aditivo) para quando
// ganharem suporte, mas o formulário avisa que por ora caem para um link simples.
const PROVIDER_OPTIONS: { value: VideoProvider; label: string }[] = [
  { value: "YOUTUBE", label: "YouTube" },
  { value: "VIMEO", label: "Vimeo (ainda sem player embutido — abre em link)" },
  { value: "CLOUD_STORAGE", label: "Armazenamento próprio (ainda sem player embutido — abre em link)" },
  { value: "INTERNAL", label: "Interno (ainda sem player embutido — abre em link)" },
];

function statusLabel(task: MissionTaskWithVideo): string {
  if (!task.video) return "Sem vídeo";
  return task.video.active ? "Vídeo ativo" : "Vídeo desativado";
}

/**
 * Formulário de vídeo de uma etapa (Fase 10.3). O mesmo formulário serve
 * para criar, editar e "trocar" o vídeo (item 8 do aditivo) — internamente
 * é sempre um PUT (upsert): só existe um vídeo por etapa por vez.
 */
function MissionTaskVideoForm({
  missionId,
  task,
  onDone,
}: {
  missionId: string;
  task: MissionTaskWithVideo;
  onDone: () => void;
}) {
  const router = useRouter();
  const existing = task.video;
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

    const res = await fetch(`/api/missions/${missionId}/tasks/${task.id}/video`, {
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
    await fetch(`/api/missions/${missionId}/tasks/${task.id}/video`, { method: "DELETE" });
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

/** Uma linha de etapa dentro do painel de vídeos (Fase 10.3): status + botão para abrir o formulário. */
function MissionTaskVideoRow({ missionId, index, task }: { missionId: string; index: number; task: MissionTaskWithVideo }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-border text-[11px] font-medium text-muted">
            {index}
          </span>
          <p className="text-sm text-foreground">{task.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{statusLabel(task)}</span>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background"
            >
              {task.video ? "Editar vídeo" : "Adicionar vídeo"}
            </button>
          )}
        </div>
      </div>
      {open && <MissionTaskVideoForm missionId={missionId} task={task} onDone={() => setOpen(false)} />}
    </div>
  );
}

/**
 * Painel colapsável com as etapas de uma missão e o gerenciamento de vídeo
 * de cada uma (Fase 10.3). Usado na tela "Formação" (admin/professor).
 */
export function MissionVideosPanel({ missionId, tasks }: { missionId: string; tasks: MissionTaskWithVideo[] }) {
  const [open, setOpen] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-xs font-medium text-primary underline underline-offset-2"
      >
        {open ? "Ocultar vídeos das etapas" : "Gerenciar vídeos das etapas"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {tasks.map((task, i) => (
            <MissionTaskVideoRow key={task.id} missionId={missionId} index={i + 1} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
