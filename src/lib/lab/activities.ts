import { z } from "zod";

/**
 * ILTECN LAB — atividades interativas.
 *
 * Tudo aqui é função pura (sem banco, sem React): schemas de configuração por
 * tipo de atividade, a versão "pública" da configuração (sem as respostas
 * certas, que nunca saem do servidor) e a correção de uma tentativa.
 */

export const ACTIVITY_KINDS = [
  "choice",
  "match",
  "order",
  "drag",
  "type",
  "files",
  "gesture",
  "draw",
  "desktop",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_CATEGORIES = ["knowledge", "practice", "challenge"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const LAB_SKILLS = [
  "computador",
  "mouse",
  "teclado",
  "arquivos",
  "producao",
  "internet",
  "seguranca",
] as const;
export type LabSkill = (typeof LAB_SKILLS)[number];

export const SKILL_LABELS: Record<LabSkill, { label: string; emoji: string }> = {
  computador: { label: "Computador", emoji: "💻" },
  mouse: { label: "Mouse", emoji: "🖱️" },
  teclado: { label: "Teclado", emoji: "⌨️" },
  arquivos: { label: "Arquivos", emoji: "📁" },
  producao: { label: "Produção", emoji: "📝" },
  internet: { label: "Internet", emoji: "🌐" },
  seguranca: { label: "Segurança", emoji: "🔐" },
};

// ---- Configurações por tipo -------------------------------------------------

const hint = z.string().max(300).optional();

export const choiceConfig = z.object({
  question: z.string().min(1).max(300),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        text: z.string().min(1).max(200),
        emoji: z.string().max(8).optional(),
      })
    )
    .min(2)
    .max(8),
  answer: z.array(z.string()).min(1),
  multiple: z.boolean().optional(),
  display: z.enum(["list", "cards", "keys"]).optional(),
  hint,
});

export const matchConfig = z.object({
  pairs: z
    .array(
      z.object({
        left: z.string().min(1).max(80),
        right: z.string().min(1).max(80),
        emoji: z.string().max(8).optional(),
      })
    )
    .min(2)
    .max(8),
  hint,
});

export const orderConfig = z.object({
  /** Itens na ORDEM CORRETA — o embaralhamento é feito na versão pública. */
  items: z.array(z.string().min(1).max(160)).min(2).max(10),
  hint,
});

export const dragConfig = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().min(1).max(60),
        emoji: z.string().max(8).optional(),
      })
    )
    .min(2)
    .max(10),
  zones: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().min(1).max(60),
        emoji: z.string().max(8).optional(),
      })
    )
    .min(2)
    .max(5),
  /** item.id -> zone.id */
  answer: z.record(z.string(), z.string()),
  hint,
});

export const typeField = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  placeholder: z.string().max(120).optional(),
  /** 'copy' = copiar `target` (aparece para o aluno); 'free' = texto livre com regras. */
  mode: z.enum(["copy", "free"]),
  target: z.string().max(200).optional(),
  minChars: z.number().int().min(1).max(200).optional(),
  minWords: z.number().int().min(1).max(30).optional(),
  mustStartUpper: z.boolean().optional(),
  mustEndPunct: z.boolean().optional(),
  digitsOnly: z.boolean().optional(),
});

export const typeConfig = z.object({
  fields: z.array(typeField).min(1).max(6),
  hint,
});

const fileGoal = z.discriminatedUnion("type", [
  z.object({ type: z.literal("folder_exists"), path: z.string().min(1) }),
  z.object({ type: z.literal("file_in"), orig: z.string().min(1), folder: z.string().min(1) }),
  z.object({ type: z.literal("file_renamed"), orig: z.string().min(1), to: z.string().min(1) }),
  z.object({ type: z.literal("file_deleted"), orig: z.string().min(1) }),
  z.object({ type: z.literal("file_copied"), orig: z.string().min(1), folder: z.string().min(1) }),
]);
export type FileGoal = z.infer<typeof fileGoal>;

export const filesConfig = z.object({
  /** Pastas já existentes, como caminhos "A" ou "A/B". */
  initialFolders: z.array(z.string()).max(20),
  initialFiles: z
    .array(z.object({ name: z.string().min(1).max(60), folder: z.string(), emoji: z.string().max(8).optional() }))
    .max(20),
  /** Texto mostrado ao aluno (a lista de metas em si não vai para o navegador). */
  instructions: z.array(z.string().min(1).max(200)).min(1).max(10),
  goals: z.array(fileGoal).min(1).max(20),
  hint,
});

export const gestureConfig = z.object({
  mode: z.enum(["move", "click", "doubleclick", "mixed"]),
  targets: z.number().int().min(1).max(12),
  hint,
});

export const drawConfig = z.object({
  minStrokes: z.number().int().min(1).max(50),
  minColors: z.number().int().min(1).max(8),
  hint,
});

export const DESKTOP_ACTIONS = [
  "open",
  "minimize",
  "maximize",
  "close",
  "switch",
  "startmenu",
] as const;
export type DesktopAction = (typeof DESKTOP_ACTIONS)[number];

export const desktopConfig = z.object({
  required: z.array(z.enum(DESKTOP_ACTIONS)).min(1),
  hint,
});

export const CONFIG_SCHEMAS = {
  choice: choiceConfig,
  match: matchConfig,
  order: orderConfig,
  drag: dragConfig,
  type: typeConfig,
  files: filesConfig,
  gesture: gestureConfig,
  draw: drawConfig,
  desktop: desktopConfig,
} as const;

export type ChoiceConfig = z.infer<typeof choiceConfig>;
export type MatchConfig = z.infer<typeof matchConfig>;
export type OrderConfig = z.infer<typeof orderConfig>;
export type DragConfig = z.infer<typeof dragConfig>;
export type TypeConfig = z.infer<typeof typeConfig>;
export type FilesConfig = z.infer<typeof filesConfig>;
export type GestureConfig = z.infer<typeof gestureConfig>;
export type DrawConfig = z.infer<typeof drawConfig>;
export type DesktopConfig = z.infer<typeof desktopConfig>;

/**
 * Valida a configuração de uma atividade conforme o tipo. Além do formato,
 * confere a consistência interna (a resposta aponta para ids que existem).
 * Devolve a mensagem de erro em português ou `null` se estiver tudo certo.
 */
export function validateActivityConfig(kind: string, config: unknown): string | null {
  if (!(kind in CONFIG_SCHEMAS)) return "Tipo de atividade desconhecido.";
  const schema = CONFIG_SCHEMAS[kind as ActivityKind];
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return `Configuração inválida${issue ? ` (${issue.path.join(".") || "raiz"}: ${issue.message})` : ""}.`;
  }

  if (kind === "choice") {
    const c = parsed.data as ChoiceConfig;
    const ids = new Set(c.options.map((o) => o.id));
    if (ids.size !== c.options.length) return "As opções precisam ter ids diferentes.";
    if (!c.answer.every((a) => ids.has(a))) return "A resposta aponta para uma opção que não existe.";
    if (!c.multiple && c.answer.length !== 1) return "Escolha simples precisa de exatamente uma resposta.";
  }
  if (kind === "drag") {
    const c = parsed.data as DragConfig;
    const items = new Set(c.items.map((i) => i.id));
    const zones = new Set(c.zones.map((z) => z.id));
    for (const id of items) {
      if (!(id in c.answer)) return `O item "${id}" está sem destino.`;
    }
    for (const [item, zone] of Object.entries(c.answer)) {
      if (!items.has(item) || !zones.has(zone)) return "A resposta aponta para item ou caixa que não existe.";
    }
  }
  if (kind === "type") {
    const c = parsed.data as TypeConfig;
    for (const f of c.fields) {
      if (f.mode === "copy" && !f.target) return `O campo "${f.id}" copia um texto, mas está sem texto-alvo.`;
    }
  }
  return null;
}

// ---- Versão pública (sem respostas) -----------------------------------------

/** Hash simples e estável — só para embaralhar de forma determinística. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Embaralha de forma determinística (mesma atividade → mesma ordem para todos
 * os alunos, sem depender de Math.random no servidor). Garante que o resultado
 * nunca seja igual à ordem original.
 */
export function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const keyed = items.map((item, i) => ({ item, key: hashString(`${seed}:${i}:${String(item)}`) }));
  keyed.sort((a, b) => a.key - b.key);
  const out = keyed.map((k) => k.item);
  const same = out.every((v, i) => v === items[i]);
  if (same && out.length > 1) out.push(out.shift() as T);
  return out;
}

export type PublicConfig = Record<string, unknown>;

/**
 * Configuração segura para enviar ao navegador: remove tudo que entrega a
 * resposta (gabarito de escolha, destino do arrastar, ordem correta, metas de
 * arquivos). A correção só acontece no servidor, em `gradeActivity`.
 */
export function toPublicConfig(kind: ActivityKind, config: unknown, seed: string): PublicConfig {
  switch (kind) {
    case "choice": {
      const c = config as ChoiceConfig;
      return {
        question: c.question,
        options: c.options,
        multiple: c.multiple ?? c.answer.length > 1,
        display: c.display ?? "list",
        hint: c.hint,
      };
    }
    case "match": {
      const c = config as MatchConfig;
      return {
        lefts: c.pairs.map((p) => ({ text: p.left, emoji: p.emoji })),
        rights: deterministicShuffle(
          c.pairs.map((p) => p.right),
          seed
        ),
        hint: c.hint,
      };
    }
    case "order": {
      const c = config as OrderConfig;
      return { items: deterministicShuffle(c.items, seed), hint: c.hint };
    }
    case "drag": {
      const c = config as DragConfig;
      return { items: deterministicShuffle(c.items, seed), zones: c.zones, hint: c.hint };
    }
    case "type": {
      const c = config as TypeConfig;
      return {
        fields: c.fields.map((f) => ({
          id: f.id,
          label: f.label,
          placeholder: f.placeholder,
          mode: f.mode,
          // O texto-alvo só é público quando o aluno precisa copiá-lo.
          target: f.mode === "copy" ? f.target : undefined,
          digitsOnly: f.digitsOnly,
        })),
        hint: c.hint,
      };
    }
    case "files": {
      const c = config as FilesConfig;
      return {
        initialFolders: c.initialFolders,
        initialFiles: c.initialFiles,
        instructions: c.instructions,
        hint: c.hint,
      };
    }
    default:
      return { ...(config as Record<string, unknown>) };
  }
}

// ---- Correção -----------------------------------------------------------------

export interface GradeResult {
  /** Acertou tudo nesta tentativa. */
  correct: boolean;
  /** 0–100: percentual certo nesta tentativa. */
  percent: number;
  /** Mensagem curta e positiva para a criança. */
  feedback: string;
}

const OK_MESSAGES = ["🎉 Muito bem!", "⭐ Você conseguiu!", "👏 Isso mesmo!", "🚀 Mandou bem!"];

export function successMessage(seed: string): string {
  return OK_MESSAGES[hashString(seed) % OK_MESSAGES.length];
}

function retryMessage(hintText?: string): string {
  return hintText ? `💡 Dica: ${hintText}` : "💡 Quase lá! Tente de novo.";
}

function result(correct: boolean, percent: number, seed: string, hintText?: string): GradeResult {
  return correct
    ? { correct: true, percent: 100, feedback: successMessage(seed) }
    : { correct: false, percent: Math.max(0, Math.min(99, Math.round(percent))), feedback: retryMessage(hintText) };
}

function norm(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return sa.size === a.length && b.every((x) => sa.has(x));
}

const PUNCT = /[.!?…]$/;

/** Regras de um campo de digitação; `null` = válido. */
export function checkTypeField(field: z.infer<typeof typeField>, raw: string): boolean {
  const text = raw.trim().replace(/\s+/g, " ");
  if (field.mode === "copy") {
    // Copiar exatamente (ignorando espaços a mais), respeitando maiúsculas.
    return text === (field.target ?? "").trim().replace(/\s+/g, " ");
  }
  if (text.length === 0) return false;
  if (field.digitsOnly && !/^\d+$/.test(text)) return false;
  if (field.minChars && text.length < field.minChars) return false;
  if (field.minWords && text.split(" ").filter(Boolean).length < field.minWords) return false;
  if (field.mustStartUpper && !/^\p{Lu}/u.test(text)) return false;
  if (field.mustEndPunct && !PUNCT.test(text)) return false;
  return true;
}

export interface FilesSubmissionEntry {
  orig: string;
  name: string;
  folder: string;
  deleted: boolean;
  isCopy: boolean;
}
export interface FilesSubmission {
  folders: string[];
  files: FilesSubmissionEntry[];
}

function sameName(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

export function checkFileGoal(goal: FileGoal, sub: FilesSubmission): boolean {
  const live = sub.files.filter((f) => !f.deleted);
  switch (goal.type) {
    case "folder_exists":
      return sub.folders.some((f) => sameName(f, goal.path));
    case "file_in":
      return live.some((f) => !f.isCopy && sameName(f.orig, goal.orig) && sameName(f.folder, goal.folder));
    case "file_renamed":
      return live.some((f) => !f.isCopy && sameName(f.orig, goal.orig) && sameName(f.name, goal.to));
    case "file_deleted":
      return sub.files.some((f) => !f.isCopy && sameName(f.orig, goal.orig) && f.deleted);
    case "file_copied":
      return (
        live.some((f) => f.isCopy && sameName(f.orig, goal.orig) && sameName(f.folder, goal.folder)) &&
        live.some((f) => !f.isCopy && sameName(f.orig, goal.orig))
      );
  }
}

const desktopSubmission = z.object({ actions: z.array(z.string()).max(200) });
const gestureSubmission = z.object({ done: z.literal(true) });
const drawSubmission = z.object({
  strokes: z.number().int().min(0).max(100000),
  colors: z.number().int().min(0).max(100),
});
const orderSubmission = z.object({ order: z.array(z.string()) });
const choiceSubmission = z.object({ selected: z.array(z.string()) });
const matchSubmission = z.object({ pairs: z.record(z.string(), z.string()) });
const dragSubmission = z.object({ placements: z.record(z.string(), z.string()) });
const typeSubmission = z.object({ values: z.record(z.string(), z.string().max(400)) });
const filesSubmission = z.object({
  folders: z.array(z.string().max(120)).max(60),
  files: z
    .array(
      z.object({
        orig: z.string().max(80),
        name: z.string().max(80),
        folder: z.string().max(120),
        deleted: z.boolean(),
        isCopy: z.boolean(),
      })
    )
    .max(80),
});

export const SUBMISSION_SCHEMAS = {
  choice: choiceSubmission,
  match: matchSubmission,
  order: orderSubmission,
  drag: dragSubmission,
  type: typeSubmission,
  files: filesSubmission,
  gesture: gestureSubmission,
  draw: drawSubmission,
  desktop: desktopSubmission,
} as const;

/**
 * Corrige uma tentativa. `config` é o gabarito completo (vem do banco);
 * `submission` é o que o navegador enviou e NÃO é confiável — por isso é
 * validado por schema e comparado ao gabarito aqui, no servidor.
 *
 * Observação honesta sobre confiança: tipos baseados em gesto de mouse
 * (`gesture`, `draw`, `desktop`) não têm como ser provados pelo servidor;
 * a tentativa é aceita se o navegador relata a conclusão. Para uma criança
 * praticando, o custo de "trapacear" é só o próprio XP — não afeta ninguém.
 */
export function gradeActivity(
  kind: ActivityKind,
  config: unknown,
  submission: unknown,
  seed: string
): GradeResult {
  const parsed = SUBMISSION_SCHEMAS[kind].safeParse(submission);
  if (!parsed.success) {
    return { correct: false, percent: 0, feedback: "💡 Não entendi a resposta. Tente de novo." };
  }
  const sub = parsed.data as never;

  switch (kind) {
    case "choice": {
      const c = config as ChoiceConfig;
      const selected = (sub as z.infer<typeof choiceSubmission>).selected;
      const ok = sameSet(selected, c.answer);
      const hits = selected.filter((s) => c.answer.includes(s)).length;
      const wrong = selected.length - hits;
      const percent = ok ? 100 : (Math.max(0, hits - wrong) / c.answer.length) * 100;
      return result(ok, percent, seed, c.hint);
    }
    case "match": {
      const c = config as MatchConfig;
      const pairs = (sub as z.infer<typeof matchSubmission>).pairs;
      const hits = c.pairs.filter((p) => pairs[p.left] === p.right).length;
      return result(hits === c.pairs.length, (hits / c.pairs.length) * 100, seed, c.hint);
    }
    case "order": {
      const c = config as OrderConfig;
      const order = (sub as z.infer<typeof orderSubmission>).order;
      const valid = order.length === c.items.length && sameSet(order, c.items);
      if (!valid) return result(false, 0, seed, c.hint);
      const hits = c.items.filter((item, i) => order[i] === item).length;
      return result(hits === c.items.length, (hits / c.items.length) * 100, seed, c.hint);
    }
    case "drag": {
      const c = config as DragConfig;
      const placements = (sub as z.infer<typeof dragSubmission>).placements;
      const hits = c.items.filter((i) => placements[i.id] === c.answer[i.id]).length;
      return result(hits === c.items.length, (hits / c.items.length) * 100, seed, c.hint);
    }
    case "type": {
      const c = config as TypeConfig;
      const values = (sub as z.infer<typeof typeSubmission>).values;
      const hits = c.fields.filter((f) => checkTypeField(f, values[f.id] ?? "")).length;
      return result(hits === c.fields.length, (hits / c.fields.length) * 100, seed, c.hint);
    }
    case "files": {
      const c = config as FilesConfig;
      const s = sub as FilesSubmission;
      const hits = c.goals.filter((g) => checkFileGoal(g, s)).length;
      return result(hits === c.goals.length, (hits / c.goals.length) * 100, seed, c.hint);
    }
    case "gesture":
      return result(true, 100, seed);
    case "draw": {
      const c = config as DrawConfig;
      const s = sub as z.infer<typeof drawSubmission>;
      const ok = s.strokes >= c.minStrokes && s.colors >= c.minColors;
      const percent = Math.min(s.strokes / c.minStrokes, s.colors / c.minColors) * 100;
      return result(ok, percent, seed, c.hint);
    }
    case "desktop": {
      const c = config as DesktopConfig;
      const done = new Set((sub as z.infer<typeof desktopSubmission>).actions);
      const hits = c.required.filter((a) => done.has(a)).length;
      return result(hits === c.required.length, (hits / c.required.length) * 100, seed, c.hint);
    }
  }
}

/**
 * Nota final de uma atividade concluída, a partir de quantas tentativas
 * erradas vieram antes do acerto. Nunca cai abaixo de 40: errar faz parte
 * de aprender (a nota baixa não bloqueia nem pune a criança).
 */
export function scoreFromAttempts(wrongAttemptsBefore: number): number {
  return Math.max(40, 100 - 20 * Math.max(0, wrongAttemptsBefore));
}
