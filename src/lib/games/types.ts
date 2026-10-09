import { z } from "zod";
import {
  GAME_AUDIENCES,
  GAME_DIFFICULTIES,
  GAME_TYPES,
  type AttemptSummary,
  type Guidance,
  type PublicPhase,
} from "@/lib/games/engine";

/** Metadados de um jogo (a parte editável pelo administrador, sem a configuração das fases). */
const uuidOrNull = z.string().uuid().nullable().optional();

export const gameMetaSchema = z.object({
  code: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,59}$/, "Código: 3 a 60 letras minúsculas, números, - ou _."),
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(1000).default(""),
  instructions: z.string().trim().max(2000).default(""),
  audience: z.enum(GAME_AUDIENCES).default("all"),
  difficulty: z.enum(GAME_DIFFICULTIES).default("facil"),
  gameType: z.enum(GAME_TYPES).default("mixed"),
  trackId: uuidOrNull,
  moduleId: uuidOrNull,
  missionId: uuidOrNull,
  requiresMissionId: uuidOrNull,
  requiresGameId: uuidOrNull,
  completesMission: z.boolean().default(false),
  passPercent: z.number().int().min(1).max(100).default(70),
  maxAttempts: z.number().int().min(1).max(100).nullable().optional(),
  timeLimitSeconds: z.number().int().min(30).max(7200).nullable().optional(),
  xpReward: z.number().int().min(0).max(500).default(50),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type GameMetaInput = z.infer<typeof gameMetaSchema>;

export type GameStatus = "draft" | "published";
export type AttemptStatus = "in_progress" | "passed" | "failed";
export type GameCardState = "locked" | "available" | "in_progress" | "completed" | "limit";

export interface GameCard {
  id: string;
  code: string;
  title: string;
  description: string;
  difficulty: string;
  gameType: string;
  xpReward: number;
  passPercent: number;
  maxAttempts: number | null;
  phases: number;
  missionTitle: string | null;
  state: GameCardState;
  lockReason: string | null;
  attempts: number;
  bestPercent: number;
  completed: boolean;
}

export interface ChallengeProgress {
  tries: number;
  resolved: boolean;
  correct: boolean;
  points: number;
  /** Explicação — só vem preenchida para desafios já resolvidos. */
  explain: string | null;
}

/** Fase como o navegador recebe: fases ainda bloqueadas chegam SEM os desafios. */
export type ViewPhase = Omit<PublicPhase, "challenges"> & {
  locked: boolean;
  challengeCount: number;
  challenges: PublicPhase["challenges"];
};

export interface OpenAttemptView {
  id: string;
  version: number;
  startedAt: string;
  expiresAt: string | null;
  phases: ViewPhase[];
  progress: Record<string, ChallengeProgress>;
  summary: AttemptSummary;
}

export interface FinishedResult {
  attemptId: string;
  passed: boolean;
  endedReason: "completed" | "time" | "left";
  percent: number;
  points: number;
  pointsPossible: number;
  stars: number;
  correctCount: number;
  wrongCount: number;
  durationSeconds: number;
  xpAwarded: number;
  alreadyCompleted: boolean;
  summary: AttemptSummary;
  guidance: Guidance | null;
  newAchievements: { name: string; icon: string | null }[];
  missionCompleted: boolean;
  totalPoints: number;
}

export interface GameDetail extends GameCard {
  instructions: string;
  timeLimitSeconds: number | null;
  attemptsLeft: number | null;
  kids: boolean;
  open: OpenAttemptView | null;
  last: FinishedResult | null;
}
