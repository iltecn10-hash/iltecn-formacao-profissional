"use client";

import { useState } from "react";
import { primaryBtn, softBtn, type ActivityProps } from "./ui";

// ---------------------------------------------------------------- escolha
interface ChoiceCfg {
  question: string;
  options: { id: string; text: string; emoji?: string }[];
  multiple: boolean;
  display: "list" | "cards" | "keys";
}

export function ChoiceActivity({ config, disabled, onSubmit }: ActivityProps<ChoiceCfg>) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(id: string) {
    if (disabled) return;
    setSelected((cur) =>
      config.multiple ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]
    );
  }
  const layout =
    config.display === "list" ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3";
  return (
    <div>
      <p className="text-lg font-semibold text-foreground">{config.question}</p>
      {config.multiple && <p className="mt-1 text-sm text-muted">Pode escolher mais de uma.</p>}
      <div className={`mt-4 ${layout}`} role={config.multiple ? "group" : "radiogroup"}>
        {config.options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role={config.multiple ? "checkbox" : "radio"}
              aria-checked={on}
              onClick={() => toggle(o.id)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${
                on ? "border-primary bg-primary-light text-primary-dark" : "border-border bg-surface hover:border-primary"
              } ${config.display === "keys" ? "justify-center font-mono text-2xl shadow-[0_4px_0_0_var(--border)]" : ""}`}
            >
              {o.emoji && <span className="text-2xl" aria-hidden>{o.emoji}</span>}
              <span>{o.text}</span>
              {on && <span className="ml-auto" aria-hidden>✔</span>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={disabled || selected.length === 0}
        onClick={() => onSubmit({ selected })}
        className={`${primaryBtn} mt-5`}
      >
        Responder
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- ligar
interface MatchCfg {
  lefts: { text: string; emoji?: string }[];
  rights: string[];
}

export function MatchActivity({ config, disabled, onSubmit }: ActivityProps<MatchCfg>) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const usedRights = new Set(Object.values(pairs));

  function pickLeft(text: string) {
    if (disabled) return;
    if (pairs[text]) {
      setPairs((p) => {
        const n = { ...p };
        delete n[text];
        return n;
      });
      setActive(null);
    } else setActive(text);
  }
  function pickRight(text: string) {
    if (disabled || !active || usedRights.has(text)) return;
    setPairs((p) => ({ ...p, [active]: text }));
    setActive(null);
  }
  const ready = Object.keys(pairs).length === config.lefts.length;
  return (
    <div>
      <p className="text-sm text-muted">Toque em um item da esquerda e depois no par dele na direita. Toque de novo para desfazer.</p>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          {config.lefts.map((l) => (
            <button
              key={l.text}
              type="button"
              onClick={() => pickLeft(l.text)}
              aria-pressed={active === l.text}
              className={`min-h-12 rounded-2xl border-2 px-3 py-2 text-left text-base font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${
                active === l.text ? "border-accent bg-accent-light" : pairs[l.text] ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary"
              }`}
            >
              {l.emoji && <span aria-hidden>{l.emoji} </span>}
              {l.text}
              {pairs[l.text] && <span className="block text-sm font-normal text-primary-dark">→ {pairs[l.text]}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {config.rights.map((r) => (
            <button
              key={r}
              type="button"
              disabled={usedRights.has(r)}
              onClick={() => pickRight(r)}
              className="min-h-12 rounded-2xl border-2 border-border bg-surface px-3 py-2 text-left text-base font-semibold transition hover:border-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 disabled:opacity-40"
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <button type="button" disabled={disabled || !ready} onClick={() => onSubmit({ pairs })} className={`${primaryBtn} mt-5`}>
        Conferir
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- ordenar
export function OrderActivity({ config, disabled, onSubmit }: ActivityProps<{ items: string[] }>) {
  const [order, setOrder] = useState<string[]>(config.items);
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    setOrder((cur) => {
      const n = [...cur];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  return (
    <div>
      <p className="text-sm text-muted">Use as setas para colocar tudo na ordem certa.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {order.map((item, i) => (
          <li key={item} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white" aria-hidden>
              {i + 1}
            </span>
            <span className="flex-1 text-base font-semibold">{item}</span>
            <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className={`${softBtn} !min-h-11 !px-3 !py-1`} aria-label={`Subir: ${item}`}>
              ▲
            </button>
            <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} className={`${softBtn} !min-h-11 !px-3 !py-1`} aria-label={`Descer: ${item}`}>
              ▼
            </button>
          </li>
        ))}
      </ol>
      <button type="button" disabled={disabled} onClick={() => onSubmit({ order })} className={`${primaryBtn} mt-5`}>
        Conferir
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- arrastar
interface DragCfg {
  items: { id: string; label: string; emoji?: string }[];
  zones: { id: string; label: string; emoji?: string }[];
}

export function DragActivity({ config, disabled, onSubmit }: ActivityProps<DragCfg>) {
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);
  const pool = config.items.filter((i) => !placements[i.id]);

  function place(zoneId: string, itemId: string | null) {
    if (disabled || !itemId) return;
    setPlacements((p) => ({ ...p, [itemId]: zoneId }));
    setHeld(null);
  }
  function release(itemId: string) {
    if (disabled) return;
    setPlacements((p) => {
      const n = { ...p };
      delete n[itemId];
      return n;
    });
  }
  const chipCls = (on: boolean) =>
    `min-h-12 cursor-grab rounded-2xl border-2 px-3 py-2 text-base font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${
      on ? "border-accent bg-accent-light" : "border-border bg-surface hover:border-primary"
    }`;
  return (
    <div>
      <p className="text-sm text-muted">Arraste cada item até o lugar certo — ou toque no item e depois no lugar.</p>
      <div className="mt-4 flex min-h-16 flex-wrap gap-3 rounded-2xl bg-background p-3" aria-label="Itens para arrastar">
        {pool.length === 0 && <span className="text-sm text-muted">Tudo no lugar! Pode conferir. ✨</span>}
        {pool.map((i) => (
          <button
            key={i.id}
            type="button"
            draggable={!disabled}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", i.id);
              setHeld(i.id);
            }}
            onClick={() => setHeld(held === i.id ? null : i.id)}
            aria-pressed={held === i.id}
            className={chipCls(held === i.id)}
          >
            {i.emoji && <span aria-hidden>{i.emoji} </span>}
            {i.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {config.zones.map((z) => (
          <div
            key={z.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              place(z.id, e.dataTransfer.getData("text/plain"));
            }}
            className="rounded-2xl border-2 border-dashed border-primary/50 bg-primary-light/40 p-3"
          >
            <button
              type="button"
              onClick={() => place(z.id, held)}
              disabled={!held || disabled}
              className="w-full rounded-xl py-1 text-left text-base font-bold text-primary-dark disabled:cursor-default"
            >
              {z.emoji && <span aria-hidden>{z.emoji} </span>}
              {z.label}
            </button>
            <div className="mt-2 flex min-h-12 flex-wrap gap-2">
              {config.items
                .filter((i) => placements[i.id] === z.id)
                .map((i) => (
                  <button key={i.id} type="button" onClick={() => release(i.id)} className={chipCls(false)} title="Toque para tirar daqui">
                    {i.emoji && <span aria-hidden>{i.emoji} </span>}
                    {i.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || pool.length > 0}
        onClick={() => onSubmit({ placements })}
        className={`${primaryBtn} mt-5`}
      >
        Conferir
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- digitar
interface TypeCfg {
  fields: {
    id: string;
    label: string;
    placeholder?: string;
    mode: "copy" | "free";
    target?: string;
    digitsOnly?: boolean;
  }[];
}

export function TypeActivity({ config, disabled, onSubmit }: ActivityProps<TypeCfg>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const ready = config.fields.every((f) => (values[f.id] ?? "").trim().length > 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ values });
      }}
    >
      <div className="flex flex-col gap-5">
        {config.fields.map((f) => (
          <div key={f.id}>
            <label htmlFor={`f-${f.id}`} className="block text-base font-semibold text-foreground">
              {f.label}
            </label>
            {f.mode === "copy" && f.target && (
              <p className="mt-2 rounded-2xl bg-accent-light px-4 py-3 text-xl font-bold tracking-wide text-foreground" aria-label={`Digite: ${f.target}`}>
                {f.target}
              </p>
            )}
            <input
              id={`f-${f.id}`}
              value={values[f.id] ?? ""}
              disabled={disabled}
              inputMode={f.digitsOnly ? "numeric" : "text"}
              autoComplete="off"
              spellCheck={false}
              placeholder={f.placeholder ?? (f.mode === "copy" ? "Digite aqui…" : "")}
              onPaste={(e) => f.mode === "copy" && e.preventDefault()}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
              className="mt-2 min-h-14 w-full rounded-2xl border-2 border-border bg-surface px-4 text-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </div>
        ))}
      </div>
      <button type="submit" disabled={disabled || !ready} className={`${primaryBtn} mt-5`}>
        Conferir
      </button>
    </form>
  );
}
