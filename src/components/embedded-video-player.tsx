"use client";

import { useState } from "react";
import type { VideoProvider, VideoType } from "@/types";
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

export interface EmbeddableVideo {
  provider: VideoProvider;
  video_url: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  video_type: VideoType;
}

/**
 * Player de vídeo embutido (extraído na Fase 10.5 de `MissionStepRow`,
 * Fase 10.2/10.4): mostra um botão "Assistir vídeo" que expande, ali mesmo
 * na página, um `<iframe>` (YouTube) ou o player `<video>` nativo do
 * navegador (INTERNAL/CLOUD_STORAGE — arquivo direto). VIMEO ainda cai para
 * um link simples, por não ter um transformador de URL de embed.
 *
 * Usado tanto para o vídeo de uma etapa (`MissionStepRow`) quanto para o
 * vídeo explicativo da missão como um todo (`MissionCard`), evitando
 * duplicar essa lógica de embed nos dois lugares.
 */
export function EmbeddedVideoPlayer({ video }: { video: EmbeddableVideo }) {
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState(false);

  const embedUrl = video.provider === "YOUTUBE" ? getYoutubeEmbedUrl(video.video_url) : null;
  const isNativeVideo = video.provider === "INTERNAL" || video.provider === "CLOUD_STORAGE";
  const hasEmbeddedPlayer = Boolean(embedUrl) || isNativeVideo;
  const duration = formatDuration(video.duration_seconds);

  function handleToggle() {
    setOpen((prev) => !prev);
    setWatched(true);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {hasEmbeddedPlayer ? (
          <button
            type="button"
            onClick={handleToggle}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2"
          >
            {watched ? "↻ Assistir novamente" : "▶ Assistir vídeo"}
          </button>
        ) : (
          // Provider ainda sem player embutido (item 10 do aditivo, ex.: VIMEO): link
          // simples, sem travar o recurso enquanto o suporte a esse provedor não existe.
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

      {isNativeVideo && open && (
        <div className="mt-2 w-full max-w-md overflow-hidden rounded-md border border-border">
          <video controls preload="metadata" className="w-full" src={video.video_url}>
            Seu navegador não suporta reprodução de vídeo.
          </video>
        </div>
      )}
    </div>
  );
}
