/**
 * Avaliação do ILTECN LAB — derivada na hora a partir do que já está gravado
 * (progresso das atividades + avaliação dos trabalhos), sem tabela própria.
 *
 * Pesos pedidos para o programa: Conhecimento 30% · Prática 50% · Projeto 20%.
 * A nota é só um retrato do momento: o aluno pode refazer qualquer atividade e
 * a nota nunca bloqueia nem retira nada dele.
 */

export const EVALUATION_WEIGHTS = { knowledge: 0.3, practice: 0.5, project: 0.2 } as const;

export interface EvaluationParts {
  /** Média 0–100 das atividades de conhecimento; `null` se ainda não há nenhuma concluída. */
  knowledge: number | null;
  practice: number | null;
  project: number | null;
}

export interface EvaluationResult {
  /** 0–100, arredondado. Parte ainda não feita conta como 0. */
  score: number;
  label: EvaluationLabel;
  /** `true` enquanto alguma das três partes ainda não tem nenhum resultado. */
  partial: boolean;
}

export type EvaluationLabel =
  | "Excelente"
  | "Muito bom"
  | "Bom"
  | "Em desenvolvimento"
  | "Precisa praticar";

export function evaluationLabel(score: number): EvaluationLabel {
  if (score >= 90) return "Excelente";
  if (score >= 80) return "Muito bom";
  if (score >= 70) return "Bom";
  if (score >= 60) return "Em desenvolvimento";
  return "Precisa praticar";
}

export function computeEvaluation(parts: EvaluationParts): EvaluationResult {
  const k = parts.knowledge ?? 0;
  const p = parts.practice ?? 0;
  const j = parts.project ?? 0;
  const score = Math.round(
    k * EVALUATION_WEIGHTS.knowledge + p * EVALUATION_WEIGHTS.practice + j * EVALUATION_WEIGHTS.project
  );
  return {
    score,
    label: evaluationLabel(score),
    partial: parts.knowledge === null || parts.practice === null || parts.project === null,
  };
}

export type SkillStatus = "not_started" | "needs_practice" | "developing" | "mastered";

export const SKILL_STATUS_LABEL: Record<SkillStatus, { label: string; icon: string }> = {
  not_started: { label: "Ainda não começou", icon: "⚪" },
  needs_practice: { label: "Precisa praticar", icon: "🔴" },
  developing: { label: "Em desenvolvimento", icon: "🟡" },
  mastered: { label: "Dominado", icon: "🟢" },
};

/**
 * Status de uma habilidade. A cor nunca é a única informação (sempre vem com
 * texto e ícone diferente — acessibilidade).
 */
export function skillStatus(input: {
  completed: number;
  total: number;
  attempted: number;
}): SkillStatus {
  if (input.total === 0 || input.attempted === 0) return "not_started";
  const percent = (input.completed / input.total) * 100;
  if (percent >= 80) return "mastered";
  if (percent >= 40) return "developing";
  return "needs_practice";
}
