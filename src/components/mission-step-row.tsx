"use client";

import { useState } from "react";
import type { MissionTaskWithVideo, VideoType } from "@/types";
import { getYoutubeEmbedUrl } from "@/lib/youtube";

const VIDEO_TYPE_LABEL: Record<VideoType, string> = {
  EXPLICATIVO: "Explicativo",
  DEMONSTRATIVO: "Demonstrativo",
  EXEMPLO: "Exemplo",
  ORIENTACAO: "Orientação",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Uma etapa da missão (Fase 10.2) — primeira vez que `mission_tasks` é
 * exibida ao aluno (ver nota em `CLAUDE.md`, Fase 10.1). O vídeo é só mais
 * um recurso opcional ao lado do manual/objetivo já existentes na missão:
 * nunca bloqueia a conclusão (item 4 do aditivo), e o aluno pode assistir,
 * pausar e rever quantas vezes quiser (item 4/6) sem nenhuma penalidade na
 * nota (item 7 — mas o próprio *tracking* de progresso do vídeo fica para
 * uma subfase futura; aqui é só reprodução).
 */
export function MissionStepRow({ index, task }: { index: number; task: MissionTaskWithVideo }) {
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState(false);

  const video = task.video && task.video.active ? task.video : null;
  const embedUrl = video && video.provider === "YOUTUBE" ? getYoutubeEmbedUrl(video.video_url) : null;
  const duration = video ? formatDuration(video.duration_seconds) : null;

  function handleToggle() {
    setOpen((prev) => !prev);
    setWatched(true);
  }

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-border text-[11px] font-medium text-muted">
          {index}
        </span>
        <p className="text-sm text-foreground">{task.description}</p>
      </div>

      {video && (
        <div className="mt-2 pl-7">
          <div className="flex flex-wrap items-center gap-2">
            {embedUrl ? (
              <button
                type="button"
                onClick={handleToggle}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2"
              >
                {watched ? "↻ Assistir novamente" : "▶ Assistir vídeo"}
              </button>
            ) : (
              // Provider ainda sem player embutido (item 10 do aditivo): link simples,
              // sem travar o recurso enquanto o suporte a outros provedores não existe.
              <a
                href={video.video_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-primary underline underline-offset-2"
              >
                ▶ Assistir vídeo
              </a>
            )}
            {duration && <span className="text-xs text-muted">{duration}</span>}
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
              {VIDEO_TYPE_LABEL[video.video_type]}
            </span>
          </div>

          {video.description && <p className="mt-1 text-xs text-muted">{video.description}</p>}

          {embedUrl && open && (
            <div className="mt-2 aspect-video w-full max-w-md overflow-hidden rounded-md border border-border">
              <iframe
                src={embedUrl}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
