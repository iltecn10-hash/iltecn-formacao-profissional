"use client";

import Link from "next/link";
import { useState } from "react";
import type { Sheet, SheetStudent, StoredAnswers } from "@/modules/council/evaluations";

type Answers = Record<string, string>;
const toAnswers = (a: StoredAnswers): Answers => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.value]));

interface RowState {
  answers: Answers; version: number; status: SheetStudent["status"]; evaluationId: string | null;
  busy: boolean; msg: { ok: boolean; text: string } | null; confirming: boolean; reopening: boolean; reason: string;
}

const statusLabel = { none: "Não iniciada", draft: "Rascunho", final: "Finalizada" } as const;
const statusStyle = {
  none: "bg-background text-muted", draft: "bg-accent/20 text-foreground", final: "bg-success-light text-success",
} as const;

export function EvaluationSheet({ sheet, editable, canReopen }: { sheet: Sheet; editable: boolean; canReopen: boolean }) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(sheet.students.map((s) => [s.student_id, {
      answers: toAnswers(s.answers), version: s.version, status: s.status, evaluationId: s.evaluation_id,
      busy: false, msg: null, confirming: false, reopening: false, reason: "",
    }])));
  const [open, setOpen] = useState<string | null>(sheet.students[0]?.student_id ?? null);

  const patch = (id: string, p: Partial<RowState>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
  const setAnswer = (id: string, code: string, v: string) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], answers: { ...r[id].answers, [code]: v }, msg: null, confirming: false } }));

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
        busy: false, confirming: false, status: ev.status, version: ev.version, evaluationId: ev.id,
        msg: { ok: true, text: finalize ? "Avaliação finalizada." : "Rascunho salvo." },
      });
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

  return (
    <div className="mt-6">
      <p className="text-sm text-muted print:hidden">
        {done} de {sheet.students.length} avaliações finalizadas.
        {!editable && " Somente consulta."}
      </p>
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
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="font-medium text-foreground">{s.name}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[row.status]}`}>{statusLabel[row.status]}</span>
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
                            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-background"
                          />
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {c.options.map((o) => {
                              const on = row.answers[c.code] === o.value;
                              return (
                                <button
                                  key={o.value} type="button" aria-pressed={on}
                                  onClick={() => setAnswer(s.student_id, c.code, o.value)}
                                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
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
                    <p role="status" className={`mt-4 text-sm ${row.msg.ok ? "text-primary-dark" : "text-danger"}`}>{row.msg.text}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
                    {editable && row.status !== "final" && (
                      row.confirming ? (
                        <>
                          <span className="text-sm text-foreground">Depois de finalizar, só a coordenação pode reabrir.</span>
                          <button type="button" disabled={row.busy} onClick={() => save(s.student_id, true)}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">Confirmar finalização</button>
                          <button type="button" onClick={() => patch(s.student_id, { confirming: false })}
                            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button type="button" disabled={row.busy} onClick={() => save(s.student_id, false)}
                            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-60">
                            {row.busy ? "Salvando…" : "Salvar rascunho"}
                          </button>
                          <button type="button" disabled={row.busy} onClick={() => patch(s.student_id, { confirming: true })}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">Finalizar avaliação</button>
                        </>
                      )
                    )}
                    {canReopen && row.status === "final" && (
                      row.reopening ? (
                        <>
                          <input value={row.reason} maxLength={500} placeholder="Motivo da reabertura"
                            onChange={(e) => patch(s.student_id, { reason: e.target.value })}
                            className="min-w-64 flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                          <button type="button" disabled={row.busy || row.reason.trim().length < 3} onClick={() => reopen(s.student_id)}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Reabrir</button>
                          <button type="button" onClick={() => patch(s.student_id, { reopening: false })}
                            className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => patch(s.student_id, { reopening: true })}
                          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-background">Reabrir avaliação</button>
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
