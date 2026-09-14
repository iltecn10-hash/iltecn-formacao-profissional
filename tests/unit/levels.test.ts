import { describe, it, expect } from "vitest";
import { levelName, LEVEL_NAMES } from "@/lib/levels";

describe("levelName", () => {
  it("retorna o nome correto para cada nível de 1 a 5", () => {
    expect(levelName(1)).toBe("Usuário de Computador");
    expect(levelName(2)).toBe("Auxiliar de Escritório");
    expect(levelName(3)).toBe("Auxiliar Administrativo");
    expect(levelName(4)).toBe("Auxiliar de Comércio");
    expect(levelName(5)).toBe("Assistente Administrativo");
  });

  it("usa o nível 1 como fallback para valores desconhecidos", () => {
    expect(levelName(0)).toBe(LEVEL_NAMES[1]);
    expect(levelName(99)).toBe(LEVEL_NAMES[1]);
  });
});
