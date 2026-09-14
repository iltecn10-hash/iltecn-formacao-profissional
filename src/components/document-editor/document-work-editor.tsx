"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentWorkContent, StudentWork } from "@/types";
import { getFieldDefs, getDocumentTemplate } from "@/lib/document-templates";
import { RichField } from "./rich-field";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 1500;

function emptyContent(): DocumentWorkContent {
  return { fields: {}, rich: {} };
}

function normalizeContent(raw: Record<string, unknown>): DocumentWorkContent {
  const fields =
    raw && typeof raw.fields === "object" && raw.fields !== null
      ? (raw.fields as Record<string, string>)
      : {};
  const rich =
    raw && typeof raw.rich === "object" && raw.rich !== null
      ? (raw.rich as Record<string, Record<string, unknown>>)
      : {};
  return { fields, rich };
}

export function DocumentWorkEditor({ work }: { work: StudentWork }) {
  const router = useRouter();
  const fieldDefs = useMemo(() => getFieldDefs(work.template_key), [work.template_key]);
  const template = useMemo(() => getDocumentTemplate(work.template_key), [work.template_key]);

  const [title, setTitle] = useState(work.title);
  const [content, setContent] = useState<DocumentWorkContent>(() =>
    work.content && Object.keys(work.content).length > 0
      ? normalizeContent(work.content)
      : emptyContent()
  );
  const [status, setStatus] = useState(work.status);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLocked = status === "SUBMITTED" || status === "APPROVED";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<{ title: string; content: DocumentWorkContent } | null>(null);

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
    (nextTitle: string, nextContent: DocumentWorkContent) => {
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

  function updateFieldValue(key: string, value: string) {
    const next = { ...content, fields: { ...content.fields, [key]: value } };
    setContent(next);
    scheduleSave(title, next);
  }

  function updateRichValue(key: string, json: Record<string, unknown>) {
    const next = { ...content, rich: { ...content.rich, [key]: json } };
    setContent(next);
    scheduleSave(title, next);
  }

  function handleTitleBlur() {
    scheduleSave(title, content);
  }

  async function handleSubmitWork() {
    setSubmitError(null);
    // Garante que o último autosave pendente vá antes da entrega.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSubmitting(true);
    await persist();
    const res = await fetch(`/api/student-works/${work.id}/submit`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("SUBMITTED");
    } else {
      setSubmitError(data.error ?? "Não foi possível entregar este documento.");
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
          placeholder="Nome do documento"
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

      {template && (
        <p className="mt-1 text-sm text-muted">{template.description}</p>
      )}

      {isLocked && (
        <p className="mt-3 rounded-md bg-primary-light px-3 py-2 text-sm text-primary-dark print:hidden">
          Este documento já foi entregue e não pode mais ser editado.
        </p>
      )}

      <div id="document-print-area" className="mt-6 flex flex-col gap-5">
        {fieldDefs.map((field) => {
          if (field.kind === "richtext") {
            return (
              <RichField
                key={field.key}
                label={field.label}
                content={content.rich[field.key]}
                editable={!isLocked}
                onChange={(json) => updateRichValue(field.key, json)}
              />
            );
          }
          return (
            <div key={field.key}>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {field.label}
              </label>
              <input
                type={field.kind === "date" ? "date" : "text"}
                disabled={isLocked}
                value={content.fields[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => updateFieldValue(field.key, e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
              />
            </div>
          );
        })}
      </div>

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
          {submitting ? "Entregando…" : "Entregar documento"}
        </button>
      )}
    </div>
  );
}
