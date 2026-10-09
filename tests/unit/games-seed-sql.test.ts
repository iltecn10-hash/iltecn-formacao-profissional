import { describe, it, expect } from "vitest";
import { seedGames } from "@/modules/games/seed";
import { exploradorDigital } from "@/lib/games/content/explorador-digital";

describe("seedGames", () => {
  it("recusa semear um jogo com configuração inválida", async () => {
    const broken = { ...exploradorDigital, config: { phases: [] } } as never;
    await expect(seedGames({ query: async () => ({ rows: [] }) }, { seeds: [broken] })).rejects.toThrow(/inválido/);
  });
  it("sem overwrite não altera jogo existente", async () => {
    const calls: string[] = [];
    const db = {
      async query(text: string) {
        calls.push(text);
        if (/SELECT id FROM games/.test(text)) return { rows: [{ id: "g1" }] };
        return { rows: [{ id: "x" }] };
      },
    };
    const s = await seedGames(db);
    expect(s.gamesCreated + s.gamesUpdated).toBe(0);
    expect(calls.some((c) => /UPDATE games/.test(c))).toBe(false);
  });
});
