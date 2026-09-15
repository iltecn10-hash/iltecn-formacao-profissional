"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MissionAttemptStatus, MissionTaskWithVideo, MissionWorkConfig } from "@/types";
import { MissionStepRow } from "@/components/mission-step-row";

const statusLabel: Record<MissionAttemptStatus, string> = {
  bloqueada: "Bloqueada",
  disponivel: "Disponível",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  refazer: "Refazer",
};

const statusStyle: Record<MissionAttemptStatus, string> = {
  bloqueada: "bg-border text-muted",
  disponivel: "bg-accent-light text-accent",
  em_andamento: "bg-primary-light text-primary-dark",
  concluida: "bg-primary text-white",
  refazer: "bg-danger/10 text-danger",
};

export function MissionCard({
  id,
  title,
  context,
  objective,
  pointsValue,
  competencies,
  status,
  resourceUrl,
  submissionUrl,
  workConfig,
  tasks,
}: {
  id: string;
  title: string;
  context: string | null;
  objective: string | null;
  pointsValue: number;
  competencies: string[];
  status: MissionAttemptStatus;
  resourceUrl: string | null;
  submissionUrl: string | null;
  workConfig: MissionWorkConfig | null;
  tasks: MissionTaskWithVideo[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [openingWork, setOpeningWork] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [submission, setSubmission] = useState(submissionUrl ?? "");
  const [error, setError] = useState<string | null>(null);

  /**
   * Cria o trabalho da missão se ainda não existir, ou apenas retorna o
   * existente (`getOrCreateStudentWork` é idempotente), e abre o editor.
   * Substitui a escolha manual de missão/modelo dos formulários da 9.2/9.3
   * (seção "Fase 9.4 — Integração com missões").
   */
  async function handleOpenWork() {
    if (!workConfig) return;
    setWorkError(null);
    setOpeningWork(true);
    const res = await fetch("/api/student-works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionId: id,
        workType: workConfig.workType,
        templateKey: workConfig.templateKey ?? undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setOpeningWork(false);
    if (!res.ok) {
      setWorkError(data.error ?? "Não foi possível abrir o trabalho desta missão.");
      return;
    }
    const kind = workConfig.workType === "DOCUMENT" ? "documento" : "planilha";
    router.push(`/dashboard/trabalhos/${kind}/${data.work.id}`);
  }

  async function handleStart() {
    setLoading(true);
    await fetch("/api/missions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionId: id }),
    });
    setCurrentStatus("em_andamento");
    setLoading(false);
    router.refresh();
  }

  async function handleComplete() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/missions/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionId: id, submissionUrl: submission }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCurrentStatus("concluida");
    } else {
      setError(data.error ?? "Não foi possível concluir a missão.");
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading font-semibold text-foreground">{title}</h3>
          {context && <p className="mt-1 text-sm text-muted">{context}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[currentStatus]}`}
        >
          {statusLabel[currentStatus]}
        </span>
      </div>

      {objective && (
        <p className="mt-3 text-sm text-foreground">
          <span className="font-medium">Objetivo: </span>
          {objective}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-full border border-border px-2 py-1">
          {pointsValue} pontos
        </span>
        {competencies.map((c) => (
          <span key={c} className="rounded-full border border-border px-2 py-1">
            {c}
          </span>
        ))}
      </div>

      {resourceUrl && (
        <a
          href={resourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-2"
        >
          Baixar arquivo modelo
        </a>
      )}

      {tasks.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground">Etapas da missão</h4>
          <div className="mt-2 flex flex-col gap-2">
            {tasks.map((task, i) => (
              <MissionStepRow key={task.id} index={i + 1} task={task} />
            ))}
          </div>
        </div>
      )}

      {workConfig && currentStatus !== "bloqueada" && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleOpenWork}
            disabled={openingWork}
            className="rounded-md border border-primary px-3.5 py-2 text-sm font-medium text-primary transition hover:bg-primary-light disabled:opacity-60"
          >
            {openingWork
              ? "Abrindo…"
              : workConfig.workType === "DOCUMENT"
                ? "Abrir documento da missão"
                : "Abrir planilha da missão"}
          </button>
          {workError && <p className="mt-1.5 text-sm text-danger">{workError}</p>}
        </div>
      )}

      <div className="mt-4">
        {currentStatus === "disponivel" && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
          >
            Iniciar missão
          </button>
        )}
        {currentStatus === "em_andamento" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Link da sua entrega (opcional)
            </label>
            <input
              type="url"
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={handleComplete}
              disabled={loading}
              className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              Marcar como concluída
            </button>
          </div>
        )}
        {currentStatus === "concluida" && (
          <div>
            <p className="text-sm text-primary-dark">Missão concluída. Parabéns!</p>
            {submission && (
              <a
                href={submission}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-muted underline underline-offset-2"
              >
                Ver entrega enviada
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
