"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentWorkContent, StudentWork } from "@/types";
import { getFieldDefs, getDocumentTemplate } from "@/lib/document-templates";
import { RichField } from "./rich-field";
import { WorkEvaluationPanel } from "@/components/work-evaluation-panel";
import { WorkCommentsThread } from "@/components/work-comments-thread";

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

export function DocumentWorkEditor({
  work,
  readOnly = false,
}: {
  work: StudentWork;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const fieldDefs = useMemo(() => getFieldDefs(work.template_key), [work.template_key]);
  const template = useMemo(() => getDocumentTemplate(work.template_key), [work.template_key]);

  const [title, setTitle] = useState(work.title);
  const [content, setContent] = useState<DocumentWorkContent>(() =>
    work.content && Object.keys(work.content).length > 0
      ? normalizeContent(work.content)
      : emptyContent()
  );
  // Em modo `readOnly` (tela de staff) não existe ação de entregar por aqui,
  // então o status sempre reflete a prop `work.status` mais recente vinda do
  // servidor (útil depois de um `router.refresh()`, por exemplo após uma
  // avaliação manual). No editor do próprio aluno, `localStatus` é otimista:
  // atualiza imediatamente após a entrega, sem esperar o servidor (Fase 9.7 —
  // antes disso o componente usava `key={status}` só para forçar os painéis
  // de avaliação/comentários a buscar de novo, o que chegou a causar uma
  // duplicação visual transitória; agora eles reagem à mudança de `status`
  // via prop `refreshKey`, sem remontar nada).
  const [localStatus, setLocalStatus] = useState(work.status);
  const status = readOnly ? work.status : localStatus;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLocked = readOnly || status === "SUBMITTED" || status === "APPROVED";
  // Inclui RETURNED: é o estado em que o professor devolveu com feedback —
  // exatamente quando o aluno mais precisa ver a avaliação/comentários,
  // mesmo com o documento reaberto para edição (Fase 9.6).
  const hasSubmission =
    readOnly || status === "SUBMITTED" || status === "APPROVED" || status === "RETURNED";
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

  // Autosave reage a qualquer mudança de `content`, sempre com o valor mais
  // recente já commitado pelo React (Fase 9.7). Antes, `updateFieldValue` e
  // `updateRichValue` calculavam o próximo estado a partir da variável
  // `content` capturada no fechamento (closure) da função — dois campos
  // diferentes editados na mesma leva de atualizações do React (só possível
  // programaticamente) fariam um sobrescrever o outro. Ver a mesma observação,
  // já corrigida, em `addRow`/`addColumn` de `spreadsheet-work-editor.tsx`.
  const isFirstContentRender = useRef(true);
  useEffect(() => {
    if (isFirstContentRender.current) {
      isFirstContentRender.current = false;
      return;
    }
    scheduleSave(title, content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  function updateFieldValue(key: string, value: string) {
    setContent((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  }

  function updateRichValue(key: string, json: Record<string, unknown>) {
    setContent((prev) => ({ ...prev, rich: { ...prev.rich, [key]: json } }));
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
      setLocalStatus("SUBMITTED");
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

      {isLocked && status !== "RETURNED" && (
        <p className="mt-3 rounded-md bg-primary-light px-3 py-2 text-sm text-primary-dark print:hidden">
          Este documento já foi entregue e não pode mais ser editado.
        </p>
      )}
      {status === "RETURNED" && !readOnly && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger print:hidden">
          Este documento foi devolvido pelo professor. Reveja o feedback abaixo, ajuste o que
          for necessário e entregue novamente.
        </p>
      )}
      {hasSubmission && <WorkEvaluationPanel workId={work.id} refreshKey={status} />}
      {hasSubmission && <WorkCommentsThread workId={work.id} refreshKey={status} />}

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
          {submitting ? "Entregando…" : status === "RETURNED" ? "Entregar novamente" : "Entregar documento"}
        </button>
      )}
    </div>
  );
}
