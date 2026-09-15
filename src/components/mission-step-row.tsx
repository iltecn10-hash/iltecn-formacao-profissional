"use client";

import type { MissionTaskWithVideo } from "@/types";
import { EmbeddedVideoPlayer } from "@/components/embedded-video-player";

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
  const video = task.video && task.video.active ? task.video : null;

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
          <EmbeddedVideoPlayer video={video} />
        </div>
      )}
    </div>
  );
}
