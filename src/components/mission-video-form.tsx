"use client";

import { useState } from "react";
import type { MissionVideo } from "@/types";
import { VideoUpsertForm } from "@/components/video-upsert-form";

function statusLabel(video: MissionVideo | null): string {
  if (!video) return "Sem vídeo";
  return video.active ? "Vídeo ativo" : "Vídeo desativado";
}

/**
 * Painel de vídeo explicativo da missão como um todo (Fase 10.5) — igual ao
 * `MissionVideosPanel` da Fase 10.3, mas para o vídeo único da missão, não
 * um por etapa. Usado na tela "Formação" (admin/professor), ao lado do
 * painel de vídeos das etapas.
 */
export function MissionVideoPanel({ missionId, video }: { missionId: string; video: MissionVideo | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Vídeo explicativo da missão: {statusLabel(video)}</span>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background"
          >
            {video ? "Editar vídeo" : "Adicionar vídeo"}
          </button>
        )}
      </div>
      {open && (
        <VideoUpsertForm
          endpoint={`/api/missions/${missionId}/video`}
          existing={video}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  );
}
