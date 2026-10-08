"use client";

import { useState } from "react";
import { ACTIVITY_CATEGORIES, ACTIVITY_KINDS, LAB_SKILLS } from "@/lib/lab/activities";
import type { AdminActivity } from "@/modules/lab/content";

const inputClass = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";

interface Draft {
  id?: string;
  kind: string;
  category: string;
  skill: string;
  title: string;
  prompt: string;
  xp: number;
  active: boolean;
  config: string;
}

const EMPTY: Draft = {
  kind: "choice",
  category: "knowledge",
  skill: "computador",
  title: "",
  prompt: "",
  xp: 5,
  active: true,
  config: JSON.stringify(
    {
      question: "Qual é a resposta certa?",
      options: [
        { id: "a", text: "Opção A" },
        { id: "b", text: "Opção B" },
      ],
      answer: ["a"],
    },
    null,
    2
  ),
};

/** Gestão das atividades de uma aula (somente admin). Remover = desativar (preserva histórico). */
export function LabContentAdmin({ lessons }: { lessons: { id: string; number: number; title: string }[] }) {
  const [lessonId, setLessonId] = useState("");
  const [items, setItems] = useState<AdminActivity[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load(id: string) {
    setLessonId(id);
    setDraft(null);
    setMsg(null);
    if (!id) return setItems([]);
    const res = await fetch(`/api/lab/missions/${id}/activities`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Erro ao carregar." });
    setItems(data.activities);
  }

  async function save() {
    if (!draft) return;
    let config: unknown;
    try {
      config = JSON.parse(draft.config);
    } catch {
      return setMsg({ ok: false, text: "A configuração (JSON) está com erro de formato." });
    }
    const body = { kind: draft.kind, category: draft.category, skill: draft.skill, title: draft.title, prompt: draft.prompt, xp: Number(draft.xp), active: draft.active, config };
    const res = await fetch(draft.id ? `/api/lab/activities/${draft.id}` : `/api/lab/missions/${lessonId}/activities`, {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Não foi possível salvar." });
    setMsg({ ok: true, text: "Salvo!" });
    setDraft(null);
    await load(lessonId);
  }

  async function deactivate(id: string) {
    const res = await fetch(`/api/lab/activities/${id}`, { method: "DELETE" });
    if (res.ok) await load(lessonId);
    else setMsg({ ok: false, text: "Não foi possível desativar." });
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        Aula
        <select value={lessonId} onChange={(e) => void load(e.target.value)} className={`${inputClass} mt-1`}>
          <option value="">Escolha uma aula…</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>Aula {l.number} — {l.title}</option>
          ))}
        </select>
      </label>

      {msg && <p role="status" className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-primary-light text-primary-dark" : "bg-danger/10 text-danger"}`}>{msg.text}</p>}

      {lessonId && (
        <>
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm ${a.active ? "" : "opacity-50"}`}>
                <span className="flex-1">
                  <strong>{a.title}</strong> · {a.kind} · {a.category} · {a.skill} · {a.xp} XP{a.active ? "" : " · desativada"}
                </span>
                <button type="button" className="font-semibold text-primary underline" onClick={() => setDraft({ id: a.id, kind: a.kind, category: a.category, skill: a.skill, title: a.title, prompt: a.prompt, xp: a.xp, active: a.active, config: JSON.stringify(a.config, null, 2) })}>
                  Editar
                </button>
                {a.active && (
                  <button type="button" className="font-semibold text-danger underline" onClick={() => void deactivate(a.id)}>
                    Desativar
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!draft && (
            <button type="button" onClick={() => setDraft(EMPTY)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
              + Nova atividade
            </button>
          )}
        </>
      )}

      {draft && (
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Tipo
            <select className={inputClass} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              {ACTIVITY_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Categoria
            <select className={inputClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {ACTIVITY_CATEGORIES.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Habilidade
            <select className={inputClass} value={draft.skill} onChange={(e) => setDraft({ ...draft, skill: e.target.value })}>
              {LAB_SKILLS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">Título
            <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="text-sm font-medium">XP
            <input type="number" min={0} max={100} className={inputClass} value={draft.xp} onChange={(e) => setDraft({ ...draft, xp: Number(e.target.value) })} />
          </label>
          <label className="text-sm font-medium sm:col-span-3">Enunciado
            <input className={inputClass} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
          </label>
          <label className="text-sm font-medium sm:col-span-3">Configuração (JSON — inclui o gabarito, nunca vai para o aluno)
            <textarea className={`${inputClass} font-mono`} rows={10} value={draft.config} onChange={(e) => setDraft({ ...draft, config: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Ativa
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="button" onClick={() => void save()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Salvar</button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-md border border-border px-4 py-2 text-sm font-semibold">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
