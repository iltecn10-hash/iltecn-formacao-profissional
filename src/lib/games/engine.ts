import { z } from "zod";
import {
  ACTIVITY_KINDS,
  SKILL_LABELS,
  gradeActivity,
  toPublicConfig,
  validateActivityConfig,
  type ActivityKind,
  type GradeResult,
  type LabSkill,
} from "@/lib/lab/activities";

/**
 * Motor da Central de Jogos Educativos — funções PURAS (sem banco, sem React).
 *
 * Um jogo é uma sequência de FASES; cada fase tem DESAFIOS. O desafio reaproveita
 * os 9 tipos de atividade do ILTECN LAB (escolha, ligar, ordenar, arrastar,
 * digitar, arquivos, gesto, desenho, janelas) e o mesmo corretor — por isso não
 * há "motor de correção" duplicado: `gradeActivity` continua sendo a única fonte
 * da verdade. Verdadeiro/falso = escolha com 2 opções; decisão com consequência =
 * escolha com `explain`; identificar objetos = escolha em cartões.
 *
 * Tudo que decide nota, XP ou desbloqueio roda no servidor sobre estas funções.
 */

export const GAME_AUDIENCES = ["professional", "kids", "all"] as const;
export type GameAudience = (typeof GAME_AUDIENCES)[number];

export const GAME_DIFFICULTIES = ["facil", "medio", "dificil"] as const;
export type GameDifficulty = (typeof GAME_DIFFICULTIES)[number];

export const GAME_TYPES = ["quiz", "practice", "simulation", "mixed"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const DIFFICULTY_LABEL: Record<GameDifficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};
export const GAME_TYPE_LABEL: Record<GameType, string> = {
  quiz: "Perguntas",
  practice: "Prática",
  simulation: "Simulação",
  mixed: "Misto",
};

export const MAX_PHASES = 10;
export const MAX_CHALLENGES_PER_PHASE = 15;

// ---- Configuração -------------------------------------------------------------

const slug = z.string().regex(/^[a-z0-9_-]{1,40}$/, "Use só letras minúsculas, números, - e _.");

export const challengeSchema = z.object({
  id: slug,
  kind: z.enum(ACTIVITY_KINDS),
  /** Habilidade avaliada (livre: serve a qualquer curso). */
  skill: z.string().regex(/^[a-z0-9_-]{2,30}$/, "Habilidade inválida."),
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(600),
  /** Mesma configuração (com gabarito) das atividades do LAB para o `kind`. */
  config: z.unknown(),
  points: z.number().int().min(1).max(100).default(10),
  /** Quantas tentativas o aluno tem neste desafio. */
  maxTries: z.number().int().min(1).max(10).default(3),
  /** Explicação mostrada DEPOIS que o desafio é resolvido (nunca antes). */
  explain: z.string().trim().max(500).optional(),
});

export const phaseSchema = z.object({
  id: slug,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
  emoji: z.string().max(8).optional(),
  /** % mínimo de aproveitamento NESTA fase para liberar a próxima. 0 = só precisa terminar. */
  minPercent: z.number().int().min(0).max(100).default(0),
  challenges: z.array(challengeSchema).min(1).max(MAX_CHALLENGES_PER_PHASE),
});

export const gameConfigSchema = z.object({
  phases: z.array(phaseSchema).min(1).max(MAX_PHASES),
});

export type GameChallenge = z.infer<typeof challengeSchema>;
export type GamePhase = z.infer<typeof phaseSchema>;
export type GameConfig = z.infer<typeof gameConfigSchema>;

/**
 * Valida a configuração de um jogo inteiro (formato + consistência de cada
 * desafio + ids únicos). Devolve a mensagem de erro em português ou `null`.
 */
export function validateGameConfig(config: unknown): string | null {
  const parsed = gameConfigSchema.safeParse(config);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return `Configuração do jogo inválida${issue ? ` (${issue.path.join(".") || "raiz"}: ${issue.message})` : ""}.`;
  }
  const phaseIds = new Set<string>();
  const challengeIds = new Set<string>();
  for (const phase of parsed.data.phases) {
    if (phaseIds.has(phase.id)) return `Fase repetida: "${phase.id}".`;
    phaseIds.add(phase.id);
    for (const ch of phase.challenges) {
      if (challengeIds.has(ch.id)) return `Desafio repetido: "${ch.id}".`;
      challengeIds.add(ch.id);
      const err = validateActivityConfig(ch.kind, ch.config);
      if (err) return `Desafio "${ch.id}": ${err}`;
    }
  }
  return null;
}

/** Lê a configuração já validada (ou `null` se estiver corrompida). */
export function parseGameConfig(raw: unknown): GameConfig | null {
  const parsed = gameConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function allChallenges(config: GameConfig): GameChallenge[] {
  return config.phases.flatMap((p) => p.challenges);
}

export function gameSkills(config: GameConfig): string[] {
  return [...new Set(allChallenges(config).map((c) => c.skill))];
}

export function skillLabel(skill: string): { label: string; emoji: string } {
  const known = SKILL_LABELS[skill as LabSkill];
  if (known) return known;
  const label = skill.replace(/[-_]/g, " ");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), emoji: "🎯" };
}

// ---- Versão pública (sem gabarito) -----------------------------------------------

export interface PublicChallenge {
  id: string;
  kind: ActivityKind;
  skill: string;
  title: string;
  prompt: string;
  points: number;
  maxTries: number;
  config: Record<string, unknown>;
}
export interface PublicPhase {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  minPercent: number;
  challenges: PublicChallenge[];
}

/**
 * O que o navegador recebe: nenhuma resposta certa, nenhuma explicação.
 * `seed` só embaralha a ordem de exibição (mesma partida → mesma ordem).
 */
export function toPublicPhases(config: GameConfig, seed: string): PublicPhase[] {
  return config.phases.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    emoji: p.emoji,
    minPercent: p.minPercent,
    challenges: p.challenges.map((c) => ({
      id: c.id,
      kind: c.kind,
      skill: c.skill,
      title: c.title,
      prompt: c.prompt,
      points: c.points,
      maxTries: c.maxTries,
      config: toPublicConfig(c.kind, c.config, `${seed}:${c.id}`),
    })),
  }));
}

// ---- Estado da partida ------------------------------------------------------------

export interface ChallengeState {
  tries: number;
  resolved: boolean;
  correct: boolean;
  /** Pontos ganhos neste desafio (0 se esgotou as tentativas sem acertar). */
  points: number;
  /** Melhor aproveitamento parcial visto numa tentativa errada (0–99). */
  bestPercent: number;
}
export interface AttemptState {
  challenges: Record<string, ChallengeState>;
}

export function emptyState(): AttemptState {
  return { challenges: {} };
}

/** Lê o estado gravado de forma defensiva (JSON vindo do banco). */
export function readState(raw: unknown): AttemptState {
  const out: AttemptState = { challenges: {} };
  const obj = (raw && typeof raw === "object" ? (raw as { challenges?: unknown }).challenges : null) as
    | Record<string, Partial<ChallengeState>>
    | null;
  if (!obj || typeof obj !== "object") return out;
  for (const [id, v] of Object.entries(obj)) {
    if (!v || typeof v !== "object") continue;
    out.challenges[id] = {
      tries: Math.max(0, Number(v.tries) || 0),
      resolved: Boolean(v.resolved),
      correct: Boolean(v.correct),
      points: Math.max(0, Number(v.points) || 0),
      bestPercent: Math.max(0, Math.min(99, Number(v.bestPercent) || 0)),
    };
  }
  return out;
}

/**
 * Fração dos pontos conforme a tentativa em que acertou: 1ª = 100%, 2ª = 70%,
 * 3ª = 50%, a partir da 4ª = 40%. Errar ensina: a nota cai pouco e nunca zera
 * quem acerta; só zera quem esgota as tentativas.
 */
export function triesFactor(tryNumber: number): number {
  if (tryNumber <= 1) return 1;
  if (tryNumber === 2) return 0.7;
  if (tryNumber === 3) return 0.5;
  return 0.4;
}

export interface AnswerOutcome {
  next: ChallengeState;
  grade: GradeResult;
  /** O desafio terminou (acertou ou esgotou as tentativas). */
  resolved: boolean;
  triesLeft: number;
}

/** Aplica uma resposta já corrigida ao estado do desafio. */
export function applyGrade(challenge: GameChallenge, prev: ChallengeState | undefined, grade: GradeResult): AnswerOutcome {
  const tries = (prev?.tries ?? 0) + 1;
  let next: ChallengeState;
  if (grade.correct) {
    next = {
      tries,
      resolved: true,
      correct: true,
      points: Math.round(challenge.points * triesFactor(tries)),
      bestPercent: 100,
    };
  } else {
    const exhausted = tries >= challenge.maxTries;
    next = {
      tries,
      resolved: exhausted,
      correct: false,
      points: 0,
      bestPercent: Math.max(prev?.bestPercent ?? 0, Math.min(99, Math.floor(grade.percent))),
    };
  }
  return { next, grade, resolved: next.resolved, triesLeft: Math.max(0, challenge.maxTries - tries) };
}

// ---- Resumo e regras de fase -----------------------------------------------------------

export interface PhaseSummary {
  id: string;
  title: string;
  possible: number;
  earned: number;
  percent: number;
  total: number;
  resolvedCount: number;
  resolved: boolean;
  /** Fase concluída E com o % mínimo atingido (libera a próxima). */
  gatePassed: boolean;
  minPercent: number;
}
export interface SkillSummary {
  skill: string;
  possible: number;
  earned: number;
  percent: number;
}
export interface AttemptSummary {
  phases: PhaseSummary[];
  skills: SkillSummary[];
  possible: number;
  earned: number;
  percent: number;
  correctCount: number;
  /** Respostas erradas (tentativas que não acertaram), somando todos os desafios. */
  wrongCount: number;
  resolvedCount: number;
  totalChallenges: number;
  allResolved: boolean;
  /** Alguma fase terminou abaixo do mínimo exigido: a partida não pode avançar. */
  blockedAtPhase: number | null;
}

function pct(earned: number, possible: number): number {
  return possible <= 0 ? 0 : Math.round((earned / possible) * 100);
}

export function summarize(config: GameConfig, state: AttemptState): AttemptSummary {
  const skills = new Map<string, { possible: number; earned: number }>();
  let correctCount = 0;
  let wrongCount = 0;
  let resolvedCount = 0;
  let total = 0;
  let possibleAll = 0;
  let earnedAll = 0;
  let blockedAtPhase: number | null = null;

  const phases: PhaseSummary[] = config.phases.map((phase, idx) => {
    let possible = 0;
    let earned = 0;
    let resolvedHere = 0;
    for (const ch of phase.challenges) {
      const st = state.challenges[ch.id];
      possible += ch.points;
      earned += st?.points ?? 0;
      total++;
      if (st?.resolved) {
        resolvedHere++;
        resolvedCount++;
      }
      if (st?.correct) correctCount++;
      if (st) wrongCount += st.tries - (st.correct ? 1 : 0);
      const sk = skills.get(ch.skill) ?? { possible: 0, earned: 0 };
      sk.possible += ch.points;
      sk.earned += st?.points ?? 0;
      skills.set(ch.skill, sk);
    }
    possibleAll += possible;
    earnedAll += earned;
    const resolved = resolvedHere === phase.challenges.length;
    const percent = pct(earned, possible);
    const gatePassed = resolved && percent >= phase.minPercent;
    if (resolved && !gatePassed && blockedAtPhase === null) blockedAtPhase = idx;
    return {
      id: phase.id,
      title: phase.title,
      possible,
      earned,
      percent,
      total: phase.challenges.length,
      resolvedCount: resolvedHere,
      resolved,
      gatePassed,
      minPercent: phase.minPercent,
    };
  });

  return {
    phases,
    skills: [...skills.entries()].map(([skill, v]) => ({ skill, ...v, percent: pct(v.earned, v.possible) })),
    possible: possibleAll,
    earned: earnedAll,
    percent: pct(earnedAll, possibleAll),
    correctCount,
    wrongCount,
    resolvedCount,
    totalChallenges: total,
    allResolved: resolvedCount === total,
    blockedAtPhase,
  };
}

/** A fase `index` está aberta quando todas as anteriores terminaram e atingiram o mínimo. */
export function isPhaseOpen(summary: AttemptSummary, index: number): boolean {
  for (let i = 0; i < index; i++) {
    if (!summary.phases[i]?.gatePassed) return false;
  }
  return true;
}

export type EndReason = "completed" | "time" | "left";

export interface FinishEvaluation {
  passed: boolean;
  percent: number;
  /** Texto para o aluno quando não passou. */
  failReason: "incomplete" | "phase_gate" | "below_pass" | null;
}

/**
 * Aprovado só quando: todos os desafios foram resolvidos, nenhuma fase ficou
 * abaixo do seu mínimo E o aproveitamento total atinge a nota de aprovação.
 * (Velocidade nunca entra na conta — só precisão.)
 */
export function evaluateFinish(summary: AttemptSummary, passPercent: number): FinishEvaluation {
  // Fase terminada abaixo do mínimo trava a partida: não dá para avançar, só encerrar.
  if (summary.blockedAtPhase !== null) return { passed: false, percent: summary.percent, failReason: "phase_gate" };
  if (!summary.allResolved) return { passed: false, percent: summary.percent, failReason: "incomplete" };
  if (summary.percent < passPercent) return { passed: false, percent: summary.percent, failReason: "below_pass" };
  return { passed: true, percent: summary.percent, failReason: null };
}

/** 0 estrelas se não passou; 1 ao passar; 2 a partir de 85%; 3 a partir de 95%. */
export function starsFor(percent: number, passed: boolean): number {
  if (!passed) return 0;
  if (percent >= 95) return 3;
  if (percent >= 85) return 2;
  return 1;
}

export interface Guidance {
  title: string;
  tips: string[];
}

/** Orientação para quem não passou: nunca constrange, sempre diz o que rever. */
export function buildGuidance(
  summary: AttemptSummary,
  evaluation: FinishEvaluation,
  passPercent: number,
  kids: boolean
): Guidance | null {
  if (evaluation.passed) return null;
  const tips: string[] = [];
  const weak = summary.skills
    .filter((s) => s.percent < 70)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 3);
  for (const s of weak) {
    const { label, emoji } = skillLabel(s.skill);
    tips.push(`${emoji} Vale rever: ${label} (você fez ${s.percent}% aqui).`);
  }
  if (evaluation.failReason === "phase_gate" && summary.blockedAtPhase !== null) {
    const p = summary.phases[summary.blockedAtPhase];
    tips.push(`A fase "${p.title}" pede pelo menos ${p.minPercent}% — você fez ${p.percent}%.`);
  } else if (evaluation.failReason === "below_pass") {
    tips.push(`Para passar é preciso ${passPercent}% — você fez ${evaluation.percent}%.`);
  } else if (evaluation.failReason === "incomplete") {
    tips.push("Ainda faltam desafios para terminar. Continue de onde parou na próxima tentativa.");
  }
  tips.push(
    kids
      ? "Errar faz parte de aprender! Respire, leia com calma e tente de novo. 💪"
      : "Revise os pontos acima e tente novamente — cada tentativa registra a sua evolução."
  );
  return { title: kids ? "Vamos tentar de novo?" : "Orientações para a próxima tentativa", tips };
}

// ---- Correção de um desafio ---------------------------------------------------------------

export function gradeChallenge(challenge: GameChallenge, submission: unknown, seed: string): GradeResult {
  return gradeActivity(challenge.kind, challenge.config, submission, `${seed}:${challenge.id}`);
}

/** Procura um desafio pelo id, devolvendo também o índice da fase. */
export function findChallenge(
  config: GameConfig,
  challengeId: string
): { challenge: GameChallenge; phaseIndex: number } | null {
  for (let i = 0; i < config.phases.length; i++) {
    const c = config.phases[i].challenges.find((x) => x.id === challengeId);
    if (c) return { challenge: c, phaseIndex: i };
  }
  return null;
}
