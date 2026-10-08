"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { primaryBtn, softBtn, type ActivityProps } from "./ui";

/** Botão de apoio: crianças com dificuldade motora podem pedir ajuda de um adulto. */
function HelpButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="mt-4 text-sm font-semibold text-muted underline">
      Um adulto me ajudou — marcar como feito
    </button>
  );
}

// ---------------------------------------------------------------- arquivos
interface FileEntry {
  orig: string;
  name: string;
  folder: string;
  deleted: boolean;
  isCopy: boolean;
  emoji?: string;
}
interface FilesCfg {
  initialFolders: string[];
  initialFiles: { name: string; folder: string; emoji?: string }[];
  instructions: string[];
}

const parentOf = (p: string) => p.split("/").slice(0, -1).join("/");
const baseOf = (p: string) => p.split("/").pop() ?? p;

export function FilesActivity({ config, disabled, onSubmit }: ActivityProps<FilesCfg>) {
  const [folders, setFolders] = useState<string[]>(config.initialFolders);
  const [files, setFiles] = useState<FileEntry[]>(
    config.initialFiles.map((f) => ({ orig: f.name, name: f.name, folder: f.folder, deleted: false, isCopy: false, emoji: f.emoji }))
  );
  const [cwd, setCwd] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [mode, setMode] = useState<null | "folder" | "rename" | "move" | "copy">(null);
  const [text, setText] = useState("");
  const [dest, setDest] = useState("");

  const subFolders = folders.filter((f) => parentOf(f) === cwd);
  const here = files.map((f, i) => ({ f, i })).filter(({ f }) => !f.deleted && f.folder === cwd);
  const allFolders = ["", ...folders];

  function run() {
    if (mode === "folder" && text.trim()) {
      const path = cwd ? `${cwd}/${text.trim()}` : text.trim();
      if (!folders.includes(path)) setFolders((c) => [...c, path]);
    }
    if (sel !== null) {
      if (mode === "rename" && text.trim()) setFiles((c) => c.map((f, i) => (i === sel ? { ...f, name: text.trim() } : f)));
      if (mode === "move") setFiles((c) => c.map((f, i) => (i === sel ? { ...f, folder: dest } : f)));
      if (mode === "copy") setFiles((c) => [...c, { ...c[sel], folder: dest, isCopy: true }]);
    }
    setMode(null);
    setText("");
    setSel(null);
  }
  function remove() {
    if (sel === null) return;
    setFiles((c) => c.map((f, i) => (i === sel ? { ...f, deleted: true } : f)));
    setSel(null);
  }

  return (
    <div>
      <ul className="list-disc space-y-1 pl-5 text-base text-foreground">
        {config.instructions.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div className="mt-4 rounded-2xl border-2 border-border bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 text-sm">
          <button type="button" onClick={() => setCwd(parentOf(cwd))} disabled={!cwd} className={`${softBtn} !min-h-10 !px-3 !py-1`} aria-label="Voltar uma pasta">
            ⬅
          </button>
          <span className="font-semibold" aria-live="polite">
            📁 Meu computador{cwd ? ` / ${cwd.split("/").join(" / ")}` : ""}
          </span>
        </div>
        <div className="grid min-h-36 grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          {subFolders.map((f) => (
            <button key={f} type="button" onDoubleClick={() => setCwd(f)} onClick={() => setCwd(f)} className="flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-primary-light focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50">
              <span className="text-4xl" aria-hidden>📁</span>
              <span className="text-sm font-semibold">{baseOf(f)}</span>
            </button>
          ))}
          {here.map(({ f, i }) => (
            <button key={i} type="button" onClick={() => setSel(i)} aria-pressed={sel === i} className={`flex flex-col items-center gap-1 rounded-xl p-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${sel === i ? "bg-accent-light ring-2 ring-accent" : "hover:bg-primary-light"}`}>
              <span className="text-4xl" aria-hidden>{f.emoji ?? "📄"}</span>
              <span className="text-sm font-semibold">{f.name}{f.isCopy ? " (cópia)" : ""}</span>
            </button>
          ))}
          {subFolders.length === 0 && here.length === 0 && <p className="col-span-full self-center text-center text-sm text-muted">Esta pasta está vazia.</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => { setMode("folder"); setText(""); }} className={softBtn}>📁 Nova pasta</button>
        <button type="button" disabled={disabled || sel === null} onClick={() => { setMode("rename"); setText(sel !== null ? files[sel].name : ""); }} className={softBtn}>✏️ Renomear</button>
        <button type="button" disabled={disabled || sel === null} onClick={() => { setMode("move"); setDest(""); }} className={softBtn}>➡️ Mover</button>
        <button type="button" disabled={disabled || sel === null} onClick={() => { setMode("copy"); setDest(""); }} className={softBtn}>📋 Copiar</button>
        <button type="button" disabled={disabled || sel === null} onClick={remove} className={softBtn}>🗑️ Excluir</button>
      </div>

      {mode && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl bg-accent-light p-3">
          {(mode === "folder" || mode === "rename") && (
            <label className="flex flex-col text-sm font-semibold">
              {mode === "folder" ? "Nome da nova pasta" : "Novo nome"}
              <input value={text} onChange={(e) => setText(e.target.value)} className="mt-1 min-h-12 rounded-xl border-2 border-border px-3 text-base" autoFocus />
            </label>
          )}
          {(mode === "move" || mode === "copy") && (
            <label className="flex flex-col text-sm font-semibold">
              Para qual pasta?
              <select value={dest} onChange={(e) => setDest(e.target.value)} className="mt-1 min-h-12 rounded-xl border-2 border-border px-3 text-base">
                {allFolders.map((f) => (
                  <option key={f} value={f}>{f === "" ? "Meu computador (início)" : f}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={run} className={primaryBtn}>Pronto</button>
          <button type="button" onClick={() => setMode(null)} className={softBtn}>Cancelar</button>
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit({ folders, files: files.map(({ orig, name, folder, deleted, isCopy }) => ({ orig, name, folder, deleted, isCopy })) })}
        className={`${primaryBtn} mt-5`}
      >
        Conferir
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- gestos do mouse
interface GestureCfg {
  mode: "move" | "click" | "doubleclick" | "mixed";
  targets: number;
}
const COLORS = ["🔴", "🟡", "🟢", "🔵", "🟣", "🟠"];
const STARS = ["⭐", "🌟", "✨", "💫"];

export function GestureActivity({ config, disabled, onSubmit }: ActivityProps<GestureCfg>) {
  const n = config.targets;
  const [done, setDone] = useState<boolean[]>(() => Array(n).fill(false));
  const sent = useRef(false);

  // Posições fixas e espalhadas (grade com leve deslocamento) — sem aleatoriedade no render.
  const positions = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const cols = Math.ceil(Math.sqrt(n * 1.6));
        const rows = Math.ceil(n / cols);
        const c = i % cols;
        const r = Math.floor(i / cols);
        return { left: ((c + 0.5) / cols) * 100 + ((i * 7) % 5) - 2, top: ((r + 0.5) / rows) * 100 + ((i * 11) % 7) - 3 };
      }),
    [n]
  );
  const kindOf = (i: number) => (config.mode === "mixed" ? (i % 2 === 0 ? "click" : "doubleclick") : config.mode);
  const mark = (i: number) => setDone((d) => (d[i] ? d : d.map((v, j) => (j === i ? true : v))));
  const left = done.filter((d) => !d).length;

  useEffect(() => {
    if (left === 0 && !sent.current && !disabled) {
      sent.current = true;
      onSubmit({ done: true });
    }
  }, [left, disabled, onSubmit]);

  const verb = { move: "Passe o ponteiro por", click: "Clique em", doubleclick: "Dê dois cliques rápidos em", mixed: "Clique (⭐) ou dê dois cliques (🌟) em" }[config.mode];
  return (
    <div>
      <p className="text-base font-semibold" aria-live="polite">
        {verb} cada figura. {left > 0 ? `Faltam ${left}.` : "Todas feitas! 🎉"}
      </p>
      <div className="relative mt-3 h-72 overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-b from-primary-light to-surface select-none">
        {positions.map((p, i) => {
          const kind = kindOf(i);
          const icon = kind === "move" ? COLORS[i % COLORS.length] : kind === "click" ? STARS[0] : STARS[1];
          return (
            <button
              key={i}
              type="button"
              disabled={disabled || done[i]}
              onPointerEnter={() => kind === "move" && mark(i)}
              onFocus={() => kind === "move" && mark(i)}
              onClick={(e) => {
                if (kind === "click") mark(i);
                // teclado (Enter) conta como "duplo clique" para quem não usa mouse
                if (kind === "doubleclick" && e.detail === 0) mark(i);
              }}
              onDoubleClick={() => kind === "doubleclick" && mark(i)}
              style={{ left: `${p.left}%`, top: `${p.top}%` }}
              className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-3xl transition focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/60 ${done[i] ? "scale-75 opacity-30" : "bg-surface shadow-md hover:scale-110"}`}
              aria-label={done[i] ? "Feito" : kind === "move" ? "Passe o ponteiro aqui" : kind === "click" ? "Clique aqui" : "Dois cliques aqui"}
            >
              {done[i] ? "✔" : icon}
            </button>
          );
        })}
      </div>
      <HelpButton disabled={disabled} onClick={() => onSubmit({ done: true })} />
    </div>
  );
}

// ---------------------------------------------------------------- desenho
interface DrawCfg {
  minStrokes: number;
  minColors: number;
}
const PALETTE = ["#d93025", "#f4b400", "#1e8e3e", "#1a73e8", "#9334e6", "#202124"];
const NAMES = ["vermelho", "amarelo", "verde", "azul", "roxo", "preto"];

export function DrawActivity({ config, disabled, onSubmit }: ActivityProps<DrawCfg>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [strokes, setStrokes] = useState(0);
  const [used, setUsed] = useState<string[]>([]);
  const drawing = useRef(false);

  function pos(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 600, y: ((e.clientY - r.top) / r.height) * 320 };
  }
  function down(e: React.PointerEvent) {
    if (disabled) return;
    const ctx = canvas.current!.getContext("2d")!;
    drawing.current = true;
    canvas.current!.setPointerCapture(e.pointerId);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    const { x, y } = pos(e);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setStrokes((s) => s + 1);
    setUsed((u) => (u.includes(color) ? u : [...u, color]));
  }
  function clear() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setStrokes(0);
    setUsed([]);
  }
  return (
    <div>
      <p className="text-base font-semibold" aria-live="polite">
        Faça pelo menos {config.minStrokes} traços usando {config.minColors} cores diferentes. Traços: {strokes} · Cores: {used.length}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Cores">
        {PALETTE.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={NAMES[i]} onClick={() => setColor(c)} style={{ background: c }} className={`h-12 w-12 rounded-full border-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/60 ${color === c ? "border-foreground" : "border-white shadow"}`} />
        ))}
        <button type="button" onClick={clear} className={softBtn}>🧽 Limpar</button>
      </div>
      <canvas
        ref={canvas}
        width={600}
        height={320}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="mt-3 w-full touch-none rounded-2xl border-2 border-border bg-white"
        aria-label="Área de desenho"
      />
      <button type="button" disabled={disabled} onClick={() => onSubmit({ strokes, colors: used.length })} className={`${primaryBtn} mt-4`}>
        Enviar meu desenho
      </button>
      <HelpButton disabled={disabled} onClick={() => onSubmit({ strokes: config.minStrokes, colors: config.minColors })} />
    </div>
  );
}

// ---------------------------------------------------------------- janelas / desktop
type DesktopAction = "open" | "minimize" | "maximize" | "close" | "switch" | "startmenu";
interface DesktopCfg {
  required: DesktopAction[];
}
interface Win {
  id: string;
  title: string;
  emoji: string;
  minimized: boolean;
  maximized: boolean;
}
const APPS = [
  { id: "pasta", title: "Minhas Fotos", emoji: "📁" },
  { id: "bloco", title: "Bloco de Notas", emoji: "📝" },
];
const ACTION_LABEL: Record<DesktopAction, string> = {
  open: "Abrir uma janela",
  minimize: "Minimizar (botão _)",
  maximize: "Maximizar (botão □)",
  close: "Fechar (botão ✕)",
  switch: "Trocar de janela",
  startmenu: "Abrir o menu Iniciar",
};

export function DesktopActivity({ config, disabled, onSubmit }: ActivityProps<DesktopCfg>) {
  const [wins, setWins] = useState<Win[]>([]);
  const [front, setFront] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [done, setDone] = useState<Set<DesktopAction>>(new Set());
  const sent = useRef(false);
  const mark = (a: DesktopAction) => setDone((d) => (d.has(a) ? d : new Set(d).add(a)));
  const allDone = config.required.every((a) => done.has(a));

  useEffect(() => {
    if (allDone && !sent.current && !disabled) {
      sent.current = true;
      onSubmit({ actions: [...done] });
    }
  }, [allDone, disabled, done, onSubmit]);

  function open(app: (typeof APPS)[number]) {
    if (disabled) return;
    setMenu(false);
    setWins((w) => (w.some((x) => x.id === app.id) ? w.map((x) => (x.id === app.id ? { ...x, minimized: false } : x)) : [...w, { ...app, minimized: false, maximized: false }]));
    setFront(app.id);
    mark("open");
  }
  const patch = (id: string, p: Partial<Win>) => setWins((w) => w.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="O que fazer">
        {config.required.map((a) => (
          <li key={a} className={done.has(a) ? "font-semibold text-primary" : "text-muted"}>
            {done.has(a) ? "✅" : "⬜"} {ACTION_LABEL[a]}
          </li>
        ))}
      </ul>

      <div className="relative mt-3 h-80 overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-br from-sky-200 to-emerald-200">
        <div className="absolute left-3 top-3 flex flex-col gap-3">
          {APPS.map((a) => (
            <button key={a.id} type="button" onClick={() => open(a)} className="flex w-20 flex-col items-center rounded-xl p-1 text-xs font-semibold hover:bg-white/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/60">
              <span className="text-3xl" aria-hidden>{a.emoji}</span>
              {a.title}
            </button>
          ))}
        </div>

        {wins.filter((w) => !w.minimized).map((w, i) => (
          <div
            key={w.id}
            onMouseDown={() => {
              if (front && front !== w.id) mark("switch");
              setFront(w.id);
            }}
            style={w.maximized ? { inset: "0 0 40px 0" } : { left: 110 + i * 40, top: 20 + i * 30, width: 260, height: 160 }}
            className={`absolute rounded-lg border-2 bg-white shadow-lg ${front === w.id ? "z-10 border-primary" : "z-0 border-border"}`}
          >
            <div className="flex items-center gap-1 rounded-t-md bg-primary px-2 py-1 text-sm font-bold text-white">
              <span className="flex-1 truncate">{w.emoji} {w.title}</span>
              <button type="button" aria-label="Minimizar" onClick={() => { patch(w.id, { minimized: true }); mark("minimize"); }} className="h-7 w-7 rounded bg-white/20 hover:bg-white/40">_</button>
              <button type="button" aria-label="Maximizar" onClick={() => { patch(w.id, { maximized: !w.maximized }); mark("maximize"); }} className="h-7 w-7 rounded bg-white/20 hover:bg-white/40">□</button>
              <button type="button" aria-label="Fechar" onClick={() => { setWins((x) => x.filter((y) => y.id !== w.id)); mark("close"); }} className="h-7 w-7 rounded bg-danger hover:opacity-80">✕</button>
            </div>
            <p className="p-3 text-sm text-muted">Esta é a janela “{w.title}”.</p>
          </div>
        ))}

        {menu && (
          <div className="absolute bottom-10 left-0 z-20 w-44 rounded-t-lg border-2 border-border bg-white p-2 shadow-lg">
            {APPS.map((a) => (
              <button key={a.id} type="button" onClick={() => open(a)} className="block w-full rounded px-2 py-2 text-left text-sm font-semibold hover:bg-primary-light">
                {a.emoji} {a.title}
              </button>
            ))}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-20 flex h-10 items-center gap-2 bg-foreground/90 px-2">
          <button type="button" onClick={() => { setMenu((m) => !m); mark("startmenu"); }} aria-expanded={menu} className="rounded bg-primary px-3 py-1 text-sm font-bold text-white">
            ⊞ Iniciar
          </button>
          {wins.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                if (front && front !== w.id) mark("switch");
                patch(w.id, { minimized: false });
                setFront(w.id);
              }}
              className={`rounded px-2 py-1 text-sm font-semibold ${front === w.id && !w.minimized ? "bg-white text-foreground" : "bg-white/30 text-white"}`}
            >
              {w.emoji} {w.title}
            </button>
          ))}
        </div>
      </div>
      <HelpButton disabled={disabled} onClick={() => onSubmit({ actions: config.required })} />
    </div>
  );
}
