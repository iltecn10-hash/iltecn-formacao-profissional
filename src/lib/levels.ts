export const LEVEL_NAMES: Record<number, string> = {
  1: "Usuário de Computador",
  2: "Auxiliar de Escritório",
  3: "Auxiliar Administrativo",
  4: "Auxiliar de Comércio",
  5: "Assistente Administrativo",
};

export function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? LEVEL_NAMES[1];
}

/**
 * Níveis do ILTECN LAB (programa infantil). Só EXIBIÇÃO: a pontuação continua
 * sendo `students.points` e `students.level` segue a régua profissional de
 * 5 níveis — nenhuma tabela ou coluna nova para isso (REUTILIZAR > CRIAR NOVO).
 */
export const KIDS_LEVELS = [
  { min: 0, name: "Explorador", emoji: "🔎" },
  { min: 300, name: "Aprendiz", emoji: "📚" },
  { min: 700, name: "Usuário", emoji: "💻" },
  { min: 1200, name: "Criador", emoji: "🎨" },
  { min: 1800, name: "Explorador Digital", emoji: "🚀" },
  { min: 2500, name: "Mestre Digital", emoji: "🏆" },
] as const;

export interface KidsLevelInfo {
  index: number;
  name: string;
  emoji: string;
  /** XP que falta para o próximo nível; `null` no nível máximo. */
  xpToNext: number | null;
  nextName: string | null;
}

export function kidsLevel(points: number): KidsLevelInfo {
  const safe = Math.max(0, Math.floor(points));
  let index = 0;
  for (let i = 0; i < KIDS_LEVELS.length; i++) {
    if (safe >= KIDS_LEVELS[i].min) index = i;
  }
  const current = KIDS_LEVELS[index];
  const next = KIDS_LEVELS[index + 1];
  return {
    index,
    name: current.name,
    emoji: current.emoji,
    xpToNext: next ? next.min - safe : null,
    nextName: next ? next.name : null,
  };
}
