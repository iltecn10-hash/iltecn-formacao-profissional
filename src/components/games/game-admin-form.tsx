"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryBtn, softBtn } from "@/components/lab/ui";
import { validateGameConfig } from "@/lib/games/engine";
import type { AdminGame } from "@/modules/games/admin";

export interface Option { id: string; label: string }

const input = "mt-1 block min-h-11 w-full rounded-xl border-2 border-border bg-surface px-3 text-base focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50";
const label = "block text-sm font-semibold text-foreground";

function Select({ name, value, onChange, options, empty }: { name: string; value: string; onChange: (v: string) => void; options: Option[]; empty: string }) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">{empty}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** Formulário simples (não é um CMS): metadados do jogo + vínculos + regras; as fases são um JSON validado. */
export function GameAdminForm({
  game, tracks, modules, missions, games,
}: {
  game: AdminGame | null;
  tracks: Option[]; modules: Option[]; missions: Option[]; games: Option[];
}) {
  const router = useRouter();
  const [f, setF] = useState({
    code: game?.code ?? "", title: game?.title ?? "", description: game?.description ?? "", instructions: game?.instructions ?? "",
    audience: game?.audience ?? "all", difficulty: game?.difficulty ?? "facil", gameType: game?.gameType ?? "mixed",
    trackId: game?.trackId ?? "", moduleId: game?.moduleId ?? "", missionId: game?.missionId ?? "",
    requiresMissionId: game?.requiresMissionId ?? "", requiresGameId: game?.requiresGameId ?? "",
    completesMission: game?.completesMission ?? false, passPercent: String(game?.passPercent ?? 70),
    maxAttempts: game?.maxAttempts?.toString() ?? "", timeLimitSeconds: game?.timeLimitSeconds?.toString() ?? "",
    xpReward: String(game?.xpReward ?? 50), sortOrder: String(game?.sortOrder ?? 0),
  });
  const [configText, setConfigText] = useState(JSON.stringify(game?.config ?? { phases: [] }, null, 2));
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((cur) => ({ ...cur, [k]: v }));

  let configCheck: string | null = null;
  let parsedConfig: unknown = null;
  try {
    parsedConfig = JSON.parse(configText);
    configCheck = validateGameConfig(parsedConfig);
  } catch {
    configCheck = "O JSON das fases está com erro de sintaxe.";
  }

  function meta() {
    return {
      code: f.code.trim(), title: f.title, description: f.description, instructions: f.instructions,
      audience: f.audience, difficulty: f.difficulty, gameType: f.gameType,
      trackId: f.trackId || null, moduleId: f.moduleId || null, missionId: f.missionId || null,
      requiresMissionId: f.requiresMissionId || null, requiresGameId: f.requiresGameId || null,
      completesMission: f.completesMission, passPercent: Number(f.passPercent),
      maxAttempts: numOrNull(f.maxAttempts), timeLimitSeconds: numOrNull(f.timeLimitSeconds),
      xpReward: Number(f.xpReward), sortOrder: Number(f.sortOrder),
    };
  }

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
    return data;
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      if (!parsedConfig || typeof parsedConfig !== "object") throw new Error("Corrija o JSON das fases antes de salvar.");
      if (game) {
        await call(`/api/admin/games/${game.id}`, "PUT", { meta: meta(), config: parsedConfig });
        setMsg({ type: "ok", text: "Salvo." });
        router.refresh();
      } else {
        const data = await call("/api/admin/games", "POST", { meta: meta(), config: parsedConfig });
        router.push(`/dashboard/jogos/${data.game.id}/editar`);
      }
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function toggle() {
    if (!game) return;
    setBusy(true); setMsg(null);
    try {
      await call(`/api/admin/games/${game.id}/status`, "POST", { status: game.status === "published" ? "draft" : "published" });
      router.refresh();
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Título<input className={input} value={f.title} onChange={(e) => set("title", e.target.value)} required /></label>
        <label className={label}>Código (único)<input className={input} value={f.code} onChange={(e) => set("code", e.target.value)} required pattern="[a-z0-9][a-z0-9_\-]{2,59}" /></label>
        <label className={`${label} sm:col-span-2`}>Descrição<textarea className={input} rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label className={`${label} sm:col-span-2`}>Instruções para o aluno<textarea className={input} rows={3} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} /></label>
        <label className={label}>Público
          <select className={input} value={f.audience} onChange={(e) => set("audience", e.target.value)}>
            <option value="all">Todos</option><option value="kids">Infantil (LAB)</option><option value="professional">Profissional</option>
          </select>
        </label>
        <label className={label}>Dificuldade
          <select className={input} value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option>
          </select>
        </label>
        <label className={label}>Tipo
          <select className={input} value={f.gameType} onChange={(e) => set("gameType", e.target.value)}>
            <option value="mixed">Misto</option><option value="quiz">Perguntas</option><option value="practice">Prática</option><option value="simulation">Simulação</option>
          </select>
        </label>
        <label className={label}>Ordem na lista<input type="number" min={0} className={input} value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></label>
      </div>

      <fieldset className="grid gap-4 rounded-2xl border-2 border-border p-4 sm:grid-cols-2">
        <legend className="px-2 font-heading font-bold">Vínculo com o curso</legend>
        <label className={label}>Trilha<Select name="track" value={f.trackId} onChange={(v) => set("trackId", v)} options={tracks} empty="— nenhuma —" /></label>
        <label className={label}>Módulo<Select name="module" value={f.moduleId} onChange={(v) => set("moduleId", v)} options={modules} empty="— nenhum —" /></label>
        <label className={label}>Missão vinculada<Select name="mission" value={f.missionId} onChange={(v) => set("missionId", v)} options={missions} empty="— nenhuma —" /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5" checked={f.completesMission} onChange={(e) => set("completesMission", e.target.checked)} />
          Passar neste jogo conclui a missão
        </label>
        <label className={label}>Liberar só depois da missão<Select name="reqm" value={f.requiresMissionId} onChange={(v) => set("requiresMissionId", v)} options={missions} empty="— sem pré-requisito —" /></label>
        <label className={label}>Liberar só depois do jogo<Select name="reqg" value={f.requiresGameId} onChange={(v) => set("requiresGameId", v)} options={games.filter((g) => g.id !== game?.id)} empty="— sem pré-requisito —" /></label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border-2 border-border p-4 sm:grid-cols-4">
        <legend className="px-2 font-heading font-bold">Regras</legend>
        <label className={label}>Nota mínima (%)<input type="number" min={1} max={100} className={input} value={f.passPercent} onChange={(e) => set("passPercent", e.target.value)} /></label>
        <label className={label}>Máx. de tentativas<input type="number" min={1} max={100} placeholder="ilimitado" className={input} value={f.maxAttempts} onChange={(e) => set("maxAttempts", e.target.value)} /></label>
        <label className={label}>Limite de tempo (s)<input type="number" min={30} max={7200} placeholder="sem limite" className={input} value={f.timeLimitSeconds} onChange={(e) => set("timeLimitSeconds", e.target.value)} /></label>
        <label className={label}>XP ao concluir<input type="number" min={0} max={500} className={input} value={f.xpReward} onChange={(e) => set("xpReward", e.target.value)} /></label>
      </fieldset>

      <div>
        <label htmlFor="cfg" className={label}>Fases e desafios (JSON — mesmos tipos de atividade do ILTECN LAB)</label>
        <textarea id="cfg" className={`${input} font-mono text-sm`} rows={16} spellCheck={false} value={configText} onChange={(e) => setConfigText(e.target.value)} aria-describedby="cfg-status" />
        <p id="cfg-status" role="status" className={`mt-1 text-sm font-semibold ${configCheck ? "text-danger" : "text-primary"}`}>
          {configCheck ?? "✔ Configuração válida — pode publicar."}
        </p>
        {game && game.attemptsCount > 0 && <p className="mt-1 text-sm text-muted">Este jogo já tem {game.attemptsCount} partida(s) registrada(s). Mudar ids de desafios não apaga o histórico, mas zera o detalhe por desafio.</p>}
      </div>

      {msg && <p role={msg.type === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 font-semibold ${msg.type === "error" ? "bg-danger/10 text-danger" : "bg-primary-light text-primary-dark"}`}>{msg.text}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryBtn} disabled={busy}>{game ? "Salvar alterações" : "Criar jogo (rascunho)"}</button>
        {game && (
          <button type="button" className={softBtn} disabled={busy} onClick={toggle}>
            {game.status === "published" ? "Despublicar" : "Publicar"}
          </button>
        )}
        {game && <span className="self-center text-sm text-muted">Situação: {game.status === "published" ? "publicado" : "rascunho"}</span>}
      </div>
    </form>
  );
}
