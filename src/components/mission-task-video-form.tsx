"use client";

import { useState } from "react";
import type { MissionTaskWithVideo } from "@/types";
import { VideoUpsertForm } from "@/components/video-upsert-form";

function statusLabel(task: MissionTaskWithVideo): string {
  if (!task.video) return "Sem vídeo";
  return task.video.active ? "Vídeo ativo" : "Vídeo desativado";
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
      {open && (
        <VideoUpsertForm
          endpoint={`/api/missions/${missionId}/tasks/${task.id}/video`}
          existing={task.video}
          onDone={() => setOpen(false)}
        />
      )}
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
