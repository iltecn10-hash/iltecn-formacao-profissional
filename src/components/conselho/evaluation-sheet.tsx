"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Sheet, SheetStudent, StoredAnswers } from "@/modules/council/evaluations";

type Answers = Record<string, string>;
const toAnswers = (a: StoredAnswers): Answers => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.value]));

interface RowState {
  answers: Answers; version: number; status: SheetStudent["status"]; evaluationId: string | null;
  busy: boolean; dirty: boolean; msg: { ok: boolean; text: string } | null; confirming: boolean; reopening: boolean; reason: string;
}

const statusLabel = { none: "Não iniciada", draft: "Rascunho", final: "Finalizada" } as const;
const statusStyle = {
  none: "bg-background text-muted", draft: "bg-accent/20 text-foreground", final: "bg-success-light text-success",
} as const;

export function EvaluationSheet({ sheet, editable, canReopen }: { sheet: Sheet; editable: boolean; canReopen: boolean }) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(sheet.students.map((s) => [s.student_id, {
      answers: toAnswers(s.answers), version: s.version, status: s.status, evaluationId: s.evaluation_id,
      busy: false, dirty: false, msg: null, confirming: false, reopening: false, reason: "",
    }])));
  const [open, setOpen] = useState<string | null>(sheet.students[0]?.student_id ?? null);

  const patch = (id: string, p: Partial<RowState>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
  const setAnswer = (id: string, code: string, v: string) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], answers: { ...r[id].answers, [code]: v }, dirty: true, msg: null, confirming: false } }));

  async function save(id: string, finalize: boolean) {
    const row = rows[id];
    patch(id, { busy: true, msg: null });
    try {
      const res = await fetch("/api/conselho/avaliacoes", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: sheet.assignment.id, periodId: sheet.period.id, studentId: id,
          answers: row.answers, finalize, ...(row.version > 0 ? { expectedVersion: row.version } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { patch(id, { busy: false, confirming: false, msg: { ok: false, text: data.error ?? "Não foi possível salvar." } }); return; }
      const ev = data.evaluation as { id: string; status: "draft" | "final"; version: number };
      patch(id, {
        busy: false, confirming: false, dirty: false, status: ev.status, version: ev.version, evaluationId: ev.id,
        msg: { ok: true, text: finalize ? "Avaliação finalizada." : "Rascunho salvo." },
      });
      // Ao finalizar, já abre o próximo aluno ainda não finalizado (sem navegar entre telas).
      if (finalize) {
        const ids = sheet.students.map((x) => x.student_id);
        const next = ids.slice(ids.indexOf(id) + 1).find((x) => rows[x]?.status !== "final");
        if (next) setOpen(next);
      }
    } catch {
      patch(id, { busy: false, msg: { ok: false, text: "Sem conexão. Tente de novo." } });
    }
  }

  async function reopen(id: string) {
    const row = rows[id];
    if (!row.evaluationId) return;
    patch(id, { busy: true, msg: null });
    const res = await fetch(`/api/conselho/avaliacoes/${row.evaluationId}/reabrir`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: row.reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { patch(id, { busy: false, msg: { ok: false, text: data.error ?? "Não foi possível reabrir." } }); return; }
    patch(id, { busy: false, reopening: false, reason: "", status: "draft", version: data.evaluation.version,
      msg: { ok: true, text: "Avaliação reaberta como rascunho." } });
  }

  const done = Object.values(rows).filter((r) => r.status === "final").length;
  const anyDirty = Object.values(rows).some((r) => r.dirty);

  // Evita perder respostas por fechar/recarregar a página sem salvar.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const requiredCodes = sheet.criteria.filter((c) => c.required).map((c) => c.code);
  const filled = (a: Answers, code: string) => (a[code] ?? "").trim() !== "";

  return (
    <div className="mt-6">
      <p className="text-sm text-muted print:hidden">
        {done} de {sheet.students.length} avaliações finalizadas.
        {!editable && " Somente consulta."}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border print:hidden" role="progressbar"
        aria-valuemin={0} aria-valuemax={sheet.students.length} aria-valuenow={done} aria-label="Avaliações finalizadas">
        <div className="h-full bg-success transition-all" style={{ width: `${sheet.students.length ? (done / sheet.students.length) * 100 : 0}%` }} />
      </div>
      {anyDirty && (
        <p role="status" className="mt-3 rounded-lg bg-warning-light px-4 py-2 text-sm font-medium text-warning print:hidden">
          Há respostas não salvas. Use “Salvar rascunho” antes de sair desta página.
        </p>
      )}
      {sheet.students.length === 0 && (
        <p className="mt-4 card p-6 text-sm text-muted">Nenhum aluno matriculado nesta turma.</p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {sheet.students.map((s) => {
          const row = rows[s.student_id];
          const isOpen = open === s.student_id;
          const locked = !editable || row.status === "final";
          return (
            <li key={s.student_id} className="card">
              <button
                type="button" aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : s.student_id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="flex items-center gap-2">
                  {row.dirty && <span className="badge badge-warning">Não salvo</span>}
                  {requiredCodes.length > 0 && row.status !== "final" && (
                    <span className="hidden text-xs text-muted sm:inline">
                      Obrigatórios: {requiredCodes.filter((c) => filled(row.answers, c)).length}/{requiredCodes.length}
                    </span>
                  )}
                  <span className={`badge ${statusStyle[row.status]}`}>{statusLabel[row.status]}</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-border px-4 py-4">
                  <div className="flex flex-col gap-5">
                    {sheet.criteria.map((c) => (
                      <fieldset key={c.code} disabled={locked || row.busy}>
                        <legend className="text-sm font-medium text-foreground">
                          {c.label}{c.required && <span className="text-danger" aria-label="obrigatório"> *</span>}
                        </legend>
                        {c.kind === "text" ? (
                          <textarea
                            value={row.answers[c.code] ?? ""} maxLength={2000} rows={3}
                            onChange={(e) => setAnswer(s.student_id, c.code, e.target.value)}
                            className="field mt-2"
                          />
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {c.options.map((o) => {
                              const on = row.answers[c.code] === o.value;
                              return (
                                <button
                                  key={o.value} type="button" aria-pressed={on}
                                  onClick={() => setAnswer(s.student_id, c.code, o.value)}
                                  className={`min-h-10 min-w-20 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${
                                    on ? "border-primary bg-primary text-white" : "border-border bg-surface text-foreground hover:bg-background"}`}
                                >
                                  {on ? "✓ " : ""}{o.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </fieldset>
                    ))}
                  </div>

                  {row.msg && (
                    <p role="status" className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${row.msg.ok ? "bg-success-light text-success" : "bg-danger-light text-danger"}`}>{row.msg.text}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
                    {editable && row.status !== "final" && (
                      row.confirming ? (
                        <>
                          <span className="text-sm text-foreground">Depois de finalizar, só a coordenação pode reabrir.</span>
                          <button type="button" disabled={row.busy} onClick={() => save(s.student_id, true)}
                            className="btn btn-primary">Confirmar finalização</button>
                          <button type="button" onClick={() => patch(s.student_id, { confirming: false })}
                            className="btn btn-secondary">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button type="button" disabled={row.busy} onClick={() => save(s.student_id, false)}
                            className="btn btn-secondary">
                            {row.busy ? "Salvando…" : "Salvar rascunho"}
                          </button>
                          <button type="button" disabled={row.busy} onClick={() => patch(s.student_id, { confirming: true })}
                            className="btn btn-primary">Finalizar avaliação</button>
                        </>
                      )
                    )}
                    {canReopen && row.status === "final" && (
                      row.reopening ? (
                        <>
                          <input value={row.reason} maxLength={500} placeholder="Motivo da reabertura"
                            onChange={(e) => patch(s.student_id, { reason: e.target.value })}
                            className="field min-w-64 flex-1" />
                          <button type="button" disabled={row.busy || row.reason.trim().length < 3} onClick={() => reopen(s.student_id)}
                            className="btn btn-primary">Reabrir</button>
                          <button type="button" onClick={() => patch(s.student_id, { reopening: false })}
                            className="btn btn-secondary">Cancelar</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => patch(s.student_id, { reopening: true })}
                          className="btn btn-secondary">Reabrir avaliação</button>
                      )
                    )}
                    <Link href={`/dashboard/conselho/relatorio/aluno/${s.student_id}`} className="text-sm text-primary-dark hover:underline">
                      Histórico do aluno
                    </Link>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
