import type { ActivityCategory, ActivityKind, LabSkill } from "@/lib/lab/activities";

/** XP padrão por categoria de atividade (calibrado para o programa somar ~2.700 XP). */
export const DEFAULT_XP: Record<ActivityCategory, number> = {
  knowledge: 5,
  practice: 10,
  challenge: 15,
};

export interface LabActivitySeed {
  code: string;
  kind: ActivityKind;
  category: ActivityCategory;
  skill: LabSkill;
  title: string;
  prompt: string;
  config: unknown;
  xp: number;
}

export interface LabLessonSeed {
  /** 1–30. Vira `missions.sort_order` (único dentro da trilha). */
  number: number;
  title: string;
  /** Explicação curta do que vamos aprender ("Aprender"). */
  context: string;
  objective: string;
  /** Passo a passo (vira `mission_tasks`). */
  steps: string[];
  estimatedMinutes: number;
  /** Pontos ao concluir a aula (missão concluída). */
  points: number;
  /** Aula que exige um trabalho no editor de documentos (Fase 9). */
  document?: boolean;
  activities: LabActivitySeed[];
}

export interface LabModuleSeed {
  name: string;
  description: string;
  lessons: LabLessonSeed[];
}

/** Atalho para montar uma atividade com o XP padrão da categoria. */
export function activity(
  code: string,
  kind: ActivityKind,
  skill: LabSkill,
  category: ActivityCategory,
  title: string,
  prompt: string,
  config: unknown,
  xp?: number
): LabActivitySeed {
  return { code, kind, skill, category, title, prompt, config, xp: xp ?? DEFAULT_XP[category] };
}

/** Emojis das teclas usados em várias aulas (ids estáveis). */
export const YES_NO = [
  { id: "sim", text: "Seguro", emoji: "✅" },
  { id: "nao", text: "Não é seguro", emoji: "❌" },
];
