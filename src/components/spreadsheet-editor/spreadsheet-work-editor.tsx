"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SpreadsheetWorkContent, StudentWork } from "@/types";
import { getInitialGrid, getSpreadsheetTemplate } from "@/lib/spreadsheet-templates";
import { SpreadsheetGrid } from "./spreadsheet-grid";
import { WorkEvaluationPanel } from "@/components/work-evaluation-panel";
import { WorkCommentsThread } from "@/components/work-comments-thread";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 1500;
const MAX_ROWS = 60;
const MAX_COLS = 20;

function normalizeContent(
  raw: Record<string, unknown>,
  templateKey: string | null
): SpreadsheetWorkContent {
  const rows = typeof raw.rows === "number" && raw.rows > 0 ? raw.rows : undefined;
  const cols = typeof raw.cols === "number" && raw.cols > 0 ? raw.cols : undefined;
  const cells =
    raw.cells && typeof raw.cells === "object"
      ? (raw.cells as Record<string, string>)
      : undefined;
  if (rows && cols && cells) return { rows, cols, cells };
  const initial = getInitialGrid(templateKey);
  return { rows: initial.rows, cols: initial.cols, cells: cells ?? initial.cells };
}

export function SpreadsheetWorkEditor({
  work,
  readOnly = false,
}: {
  work: StudentWork;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const template = useMemo(() => getSpreadsheetTemplate(work.template_key), [work.template_key]);

  const [title, setTitle] = useState(work.title);
  const [content, setContent] = useState<SpreadsheetWorkContent>(() =>
    normalizeContent(work.content ?? {}, work.template_key)
  );
  const [status, setStatus] = useState(work.status);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLocked = readOnly || status === "SUBMITTED" || status === "APPROVED";
  // Inclui RETURNED pelo mesmo motivo do editor de documentos (Fase 9.6):
  // é o estado em que o aluno mais precisa ver a avaliação e os comentários.
  const hasSubmission =
    readOnly || status === "SUBMITTED" || status === "APPROVED" || status === "RETURNED";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<{ title: string; content: SpreadsheetWorkContent } | null>(
    null
  );

  const persist = useCallback(async () => {
    const payload = latestPayloadRef.current;
    if (!payload) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/student-works/${work.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload.content, title: payload.title }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [work.id]);

  const scheduleSave = useCallback(
    (nextTitle: string, nextContent: SpreadsheetWorkContent) => {
      if (isLocked) return;
      latestPayloadRef.current = { title: nextTitle, content: nextContent };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(persist, AUTOSAVE_DEBOUNCE_MS);
    },
    [isLocked, persist]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateCell(key: string, value: string) {
    const next = { ...content, cells: { ...content.cells, [key]: value } };
    setContent(next);
    scheduleSave(title, next);
  }

  function handleTitleBlur() {
    scheduleSave(title, content);
  }

  function addRow() {
    if (content.rows >= MAX_ROWS) return;
    const next = { ...content, rows: content.rows + 1 };
    setContent(next);
    scheduleSave(title, next);
  }

  function addColumn() {
    if (content.cols >= MAX_COLS) return;
    const next = { ...content, cols: content.cols + 1 };
    setContent(next);
    scheduleSave(title, next);
  }

  async function handleSubmitWork() {
    setSubmitError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSubmitting(true);
    await persist();
    const res = await fetch(`/api/student-works/${work.id}/submit`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("SUBMITTED");
    } else {
      setSubmitError(data.error ?? "Não foi possível entregar esta planilha.");
    }
    setSubmitting(false);
    router.refresh();
  }

  const statusLabel: Record<SaveStatus, string> = {
    idle: "",
    saving: "Salvando…",
    saved: "Salvo",
    error: "Erro ao salvar. Tentando novamente...",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={title}
          disabled={isLocked}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Nome da planilha"
          className="w-full max-w-md rounded-md border border-transparent bg-transparent px-1 font-heading text-xl font-bold text-foreground outline-none transition focus:border-border focus:bg-surface focus:px-2 focus:py-1 disabled:opacity-70"
        />
        <div className="flex items-center gap-3">
          {!isLocked && saveStatus !== "idle" && (
            <span
              className={`text-xs ${saveStatus === "error" ? "text-danger" : "text-muted"}`}
            >
              {statusLabel[saveStatus]}
            </span>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-background print:hidden"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      {template && <p className="mt-1 text-sm text-muted">{template.description}</p>}

      {isLocked && status !== "RETURNED" && (
        <p className="mt-3 rounded-md bg-primary-light px-3 py-2 text-sm text-primary-dark print:hidden">
          Esta planilha já foi entregue e não pode mais ser editada.
        </p>
      )}
      {status === "RETURNED" && !readOnly && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger print:hidden">
          Esta planilha foi devolvida pelo professor. Reveja o feedback abaixo, ajuste o que for
          necessário e entregue novamente.
        </p>
      )}
      {hasSubmission && <WorkEvaluationPanel workId={work.id} />}
      {hasSubmission && <WorkCommentsThread workId={work.id} />}

      {!isLocked && (
        <p className="mt-3 text-xs text-muted print:hidden">
          Dica: comece uma célula com <code className="rounded bg-background px-1">=</code> para
          criar uma fórmula, por exemplo <code className="rounded bg-background px-1">=SOMA(A1:A5)</code>{" "}
          ou <code className="rounded bg-background px-1">=A1+B1</code>. Use Enter para descer e Tab
          para avançar de célula.
        </p>
      )}

      <div id="spreadsheet-print-area" className="mt-4">
        <SpreadsheetGrid
          rows={content.rows}
          cols={content.cols}
          cells={content.cells}
          editable={!isLocked}
          onCellChange={updateCell}
        />
      </div>

      {!isLocked && (
        <div className="mt-3 flex gap-2 print:hidden">
          <button
            type="button"
            onClick={addRow}
            disabled={content.rows >= MAX_ROWS}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-50"
          >
            + Linha
          </button>
          <button
            type="button"
            onClick={addColumn}
            disabled={content.cols >= MAX_COLS}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-50"
          >
            + Coluna
          </button>
        </div>
      )}

      {submitError && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger print:hidden">
          {submitError}
        </p>
      )}

      {!isLocked && (
        <button
          type="button"
          onClick={handleSubmitWork}
          disabled={submitting}
          className="mt-6 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60 print:hidden"
        >
          {submitting ? "Entregando…" : status === "RETURNED" ? "Entregar novamente" : "Entregar planilha"}
        </button>
      )}
    </div>
  );
}
