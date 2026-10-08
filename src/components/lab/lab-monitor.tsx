"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SKILL_LABELS, type LabSkill } from "@/lib/lab/activities";
import { SKILL_STATUS_LABEL } from "@/lib/lab/evaluation";
import type { MonitorStudent, MonitorSummary } from "@/modules/lab/monitor";

interface Payload {
  students: MonitorStudent[];
  summary: MonitorSummary;
  generatedAt: string;
}

const REFRESH_MS = 20000;

/**
 * Painel do professor/escola. Não existe tempo real no projeto: a tela
 * consulta a API a cada 20s (e só enquanto a aba está visível).
 */
export function LabMonitor({ classes, isAdmin = false }: { classes: { id: string; name: string }[]; isAdmin?: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [onlyHelp, setOnlyHelp] = useState(false);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/lab/monitor${classId ? `?classId=${classId}` : ""}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar.");
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar.");
      }
    }
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [classId, tick]);

  const students = (data?.students ?? []).filter((s) => !onlyHelp || s.needsHelp.length > 0);
  const sum = data?.summary;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">ILTECN LAB</p>
        <h1 className="font-heading text-2xl font-bold">Acompanhamento da turma</h1>
        <p className="text-sm text-muted">
          Atualiza sozinho a cada 20 segundos
          {data ? ` · última: ${new Date(data.generatedAt).toLocaleTimeString("pt-BR")}` : ""}.
        </p>
        {isAdmin && (
          <Link href="/dashboard/lab/conteudo" className="mt-1 inline-block text-sm font-semibold text-primary underline">
            Gerenciar atividades das aulas →
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm font-medium">
          Turma
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 block rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <option value="">Todas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm font-medium">
          <input type="checkbox" checked={onlyHelp} onChange={(e) => setOnlyHelp(e.target.checked)} />
          Só quem precisa de ajuda
        </label>
        <button type="button" onClick={() => setTick((t) => t + 1)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-primary-light">
          Atualizar agora
        </button>
      </div>

      {error && <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {sum && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Alunos" value={sum.students} />
          <Stat label="Progresso médio" value={`${sum.averageProgress}%`} />
          <Stat label="Precisam de ajuda" value={sum.needingHelp} />
          <Stat label="Concluíram" value={sum.finished} />
        </div>
      )}
      {sum?.hardestSkill && (
        <p className="rounded-md bg-accent-light px-3 py-2 text-sm">
          Maior dificuldade da turma: <strong>{SKILL_LABELS[sum.hardestSkill.skill as LabSkill]?.label ?? sum.hardestSkill.skill}</strong> ({sum.hardestSkill.count} aluno(s)).
        </p>
      )}

      {data && students.length === 0 && <p className="text-sm text-muted">Nenhum aluno do ILTECN LAB para mostrar.</p>}

      <ul className="space-y-3">
        {students.map((s) => (
          <li key={s.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-heading text-lg font-semibold">{s.name}</p>
                <p className="text-xs text-muted">{s.className ?? "Sem turma"} · {s.schoolName}</p>
              </div>
              <p className="text-sm">
                Aula <strong>{s.currentLesson ?? "—"}</strong> · {s.lessonsDone}/{s.lessonsTotal} concluídas · {s.level.emoji} {s.level.name} · {s.points} XP
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round((s.lessonsDone / Math.max(1, s.lessonsTotal)) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${s.name}`}>
              <div className="h-full bg-primary" style={{ width: `${(s.lessonsDone / Math.max(1, s.lessonsTotal)) * 100}%` }} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Habilidades">
              {s.skills.map((k) => {
                const st = SKILL_STATUS_LABEL[k.status];
                return (
                  <li key={k.skill} className="rounded-full border border-border px-3 py-1 text-xs font-semibold" title={st.label}>
                    {st.icon} {SKILL_LABELS[k.skill].label}: {st.label}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Projeto final: {s.finalProject === "done" ? "✅ entregue" : s.finalProject === "in_progress" ? "✏️ em andamento" : "—"} ·{" "}
              Última atividade: {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleString("pt-BR") : "nenhuma"}
              {s.hasCertificate ? " · 🎓 certificado emitido" : ""}
            </p>
            {s.needsHelp.length > 0 && (
              <ul className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {s.needsHelp.map((h) => (
                  <li key={h}>⚠️ {h}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-heading text-2xl font-bold">{value}</p>
    </div>
  );
}
