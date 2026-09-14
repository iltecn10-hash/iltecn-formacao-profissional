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
