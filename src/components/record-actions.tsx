"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export interface RecordField {
  name: string;
  label: string;
  type?: "text" | "email" | "date" | "number" | "textarea" | "select";
  value: string | number | null | undefined;
  required?: boolean;
  options?: { value: string; label: string }[];
}

/**
 * Botões "Editar", "Excluir" e "Reativar" de uma linha de cadastro. Serve para qualquer
 * cadastro: só precisa do endereço da API (`/api/<recurso>/<id>`) e dos campos editáveis.
 * Quem decide o que pode ou não é o servidor (a tela só esconde botões).
 */
export function RecordActions({
  endpoint,
  label,
  active = true,
  canEdit = true,
  canDelete = true,
  fields,
}: {
  endpoint: string;
  label: string;
  active?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  fields: RecordField[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function openEditor() {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.name] = f.value == null ? "" : String(f.value);
    setValues(initial);
    setError(null);
    setOpen(true);
  }

  async function send(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível concluir esta operação.");
        return false;
      }
      if (data.message) setNotice(data.message as string);
      router.refresh();
      return true;
    } catch {
      setError("Sem conexão. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name] ?? "";
      body[f.name] = f.type === "number" ? (v === "" ? null : Number(v)) : v;
    }
    if (await send("PATCH", body)) setOpen(false);
  }

  async function handleDelete() {
    const ok = window.confirm(
      `Excluir "${label}"?\n\nSe este cadastro nunca foi usado, ele será apagado de vez. ` +
        `Se já tiver histórico (notas, matrículas, avaliações…), será apenas desativado e poderá ser reativado.`
    );
    if (ok) await send("DELETE");
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <button type="button" onClick={openEditor} disabled={busy} className="btn btn-secondary">
            Editar
          </button>
        )}
        {canDelete && !active && (
          <button type="button" onClick={() => send("PATCH", { active: true })} disabled={busy} className="btn btn-secondary">
            Reativar
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={handleDelete} disabled={busy} className="btn btn-danger">
            Excluir
          </button>
        )}
      </div>
      {notice && <span className="max-w-xs text-xs text-muted">{notice}</span>}
      {!open && error && <span className="max-w-xs text-xs text-danger">{error}</span>}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Editar ${label}`}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <form onSubmit={handleSave} className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6">
            <h3 className="font-heading text-lg font-semibold text-foreground">Editar: {label}</h3>
            {fields.map((f) => (
              <label key={f.name} className="block text-sm font-medium text-foreground">
                {f.label}
                {f.type === "textarea" ? (
                  <textarea
                    className="field mt-1"
                    rows={3}
                    required={f.required}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                ) : f.type === "select" ? (
                  <select
                    className="field mt-1"
                    required={f.required}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field mt-1"
                    type={f.type ?? "text"}
                    required={f.required}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                )}
              </label>
            ))}
            {error && (
              <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={busy} className="btn btn-primary">
                {busy ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
