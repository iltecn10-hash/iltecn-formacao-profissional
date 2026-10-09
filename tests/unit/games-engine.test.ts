/* eslint-disable @typescript-eslint/no-explicit-any -- configs JSON de teste */
import { describe, it, expect } from "vitest";
import {
  applyGrade, buildGuidance, emptyState, evaluateFinish, findChallenge, gameSkills, gradeChallenge, isPhaseOpen,
  parseGameConfig, readState, starsFor, summarize, toPublicPhases, triesFactor, validateGameConfig, allChallenges,
  type GameConfig,
} from "@/lib/games/engine";
import { exploradorDigital } from "@/lib/games/content/explorador-digital";
import { solve } from "../setup/labSolver";

const cfg = exploradorDigital.config;

function twoPhase(): GameConfig {
  const c = (id: string): any => ({
    id, kind: "choice", skill: "computador", title: id, prompt: "p", points: 10, maxTries: 2,
    config: { question: "q", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: ["a"] },
  });
  return { phases: [
    { id: "f1", title: "Fase 1", minPercent: 60, challenges: [c("c1"), c("c2")] },
    { id: "f2", title: "Fase 2", minPercent: 0, challenges: [c("c3")] },
  ] } as GameConfig;
}

describe("configuração do jogo", () => {
  it("o jogo-piloto é válido e tem 6 fases com tipos variados", () => {
    expect(validateGameConfig(cfg)).toBeNull();
    expect(cfg.phases).toHaveLength(6);
    const kinds = new Set(allChallenges(cfg).map((c) => c.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(6);
    expect(gameSkills(cfg).length).toBeGreaterThan(3);
  });

  it("recusa configuração vazia, ids repetidos e desafio com gabarito inconsistente", () => {
    expect(validateGameConfig({ phases: [] })).toMatch(/inválida/);
    expect(validateGameConfig(null)).toMatch(/inválida/);
    const dup = twoPhase();
    dup.phases[1].challenges[0].id = "c1";
    expect(validateGameConfig(dup)).toMatch(/Desafio repetido/);
    const dupPhase = twoPhase();
    dupPhase.phases[1].id = "f1";
    expect(validateGameConfig(dupPhase)).toMatch(/Fase repetida/);
    const bad = twoPhase();
    (bad.phases[0].challenges[0].config as any).answer = ["zzz"];
    expect(validateGameConfig(bad)).toMatch(/Desafio "c1"/);
    expect(parseGameConfig({ foo: 1 })).toBeNull();
  });
});

describe("versão pública (sem gabarito)", () => {
  it("não vaza respostas, explicações nem metas de arquivos", () => {
    const text = JSON.stringify(toPublicPhases(cfg, "seed"));
    expect(text).not.toContain('"answer"');
    expect(text).not.toContain('"goals"');
    expect(text).not.toContain('"explain"');
    expect(text).not.toContain("Pula para a linha de baixo".toUpperCase()); // sanity
  });
  it("a ordem embaralhada é estável para a mesma partida", () => {
    const a = JSON.stringify(toPublicPhases(cfg, "x"));
    expect(JSON.stringify(toPublicPhases(cfg, "x"))).toBe(a);
  });
});

describe("pontuação", () => {
  it("fator por tentativa: 100% / 70% / 50% / 40%", () => {
    expect([1, 2, 3, 4, 9].map(triesFactor)).toEqual([1, 0.7, 0.5, 0.4, 0.4]);
  });
  it("acerto na 2ª tentativa vale 70% dos pontos; esgotar tentativas zera o desafio", () => {
    const ch = twoPhase().phases[0].challenges[0];
    const wrong = { correct: false, percent: 0, feedback: "x" };
    const right = { correct: true, percent: 100, feedback: "ok" };
    const first = applyGrade(ch, undefined, wrong);
    expect(first.resolved).toBe(false);
    expect(first.triesLeft).toBe(1);
    const second = applyGrade(ch, first.next, right);
    expect(second.next.points).toBe(7);
    expect(second.resolved).toBe(true);
    const lost = applyGrade(ch, first.next, wrong);
    expect(lost.resolved).toBe(true);
    expect(lost.next.points).toBe(0);
    expect(lost.next.correct).toBe(false);
  });
  it("readState tolera lixo vindo do banco", () => {
    expect(readState(null)).toEqual(emptyState());
    expect(readState({ challenges: { a: { tries: "3", points: -5 }, b: 4 } }).challenges.a).toMatchObject({ tries: 3, points: 0 });
  });
});

describe("regras de fase e aprovação", () => {
  const solved = (id: string, points = 10, tries = 1) => ({ tries, resolved: true, correct: points > 0, points, bestPercent: 100 });

  it("a fase seguinte só abre quando a anterior termina com o mínimo", () => {
    const c = twoPhase();
    let s = summarize(c, { challenges: {} });
    expect(isPhaseOpen(s, 0)).toBe(true);
    expect(isPhaseOpen(s, 1)).toBe(false);
    s = summarize(c, { challenges: { c1: solved("c1"), c2: solved("c2", 0, 2) } }); // 50% < 60%
    expect(s.phases[0].resolved).toBe(true);
    expect(s.phases[0].gatePassed).toBe(false);
    expect(s.blockedAtPhase).toBe(0);
    expect(isPhaseOpen(s, 1)).toBe(false);
    s = summarize(c, { challenges: { c1: solved("c1"), c2: solved("c2") } });
    expect(isPhaseOpen(s, 1)).toBe(true);
  });

  it("aprova só com tudo resolvido, sem fase travada e nota mínima", () => {
    const c = twoPhase();
    const all = { challenges: { c1: solved("c1"), c2: solved("c2"), c3: solved("c3") } };
    expect(evaluateFinish(summarize(c, all), 70)).toMatchObject({ passed: true, percent: 100 });
    const partial = summarize(c, { challenges: { c1: solved("c1") } });
    expect(evaluateFinish(partial, 70).failReason).toBe("incomplete");
    const low = summarize(c, { challenges: { c1: solved("c1"), c2: solved("c2"), c3: solved("c3", 0, 2) } });
    expect(evaluateFinish(low, 90).failReason).toBe("below_pass");
    const gate = summarize(c, { challenges: { c1: solved("c1"), c2: solved("c2", 0, 2) } });
    expect(evaluateFinish(gate, 70).failReason).toBe("phase_gate");
  });

  it("estrelas e orientação para quem não passou", () => {
    expect([starsFor(100, true), starsFor(90, true), starsFor(75, true), starsFor(40, false)]).toEqual([3, 2, 1, 0]);
    const c = twoPhase();
    const s = summarize(c, { challenges: { c1: solved("c1", 0, 2), c2: solved("c2", 0, 2), c3: solved("c3", 0, 2) } });
    const g = buildGuidance(s, evaluateFinish(s, 70), 70, true);
    expect(g?.tips.length).toBeGreaterThan(1);
    expect(buildGuidance(summarize(c, { challenges: { c1: solved("c1"), c2: solved("c2"), c3: solved("c3") } }), { passed: true, percent: 100, failReason: null }, 70, false)).toBeNull();
  });
});

describe("jogo-piloto: todo desafio é resolvível e errar não passa", () => {
  it("a resposta certa de cada desafio é aceita pelo corretor único", () => {
    for (const ch of allChallenges(cfg)) {
      const g = gradeChallenge(ch, solve(ch.kind, ch.config), "attempt-1");
      expect(g.correct, ch.id).toBe(true);
    }
  });
  it("resposta vazia nunca acerta", () => {
    for (const ch of allChallenges(cfg)) {
      expect(gradeChallenge(ch, {}, "attempt-1").correct, ch.id).toBe(false);
    }
  });
  it("findChallenge devolve a fase do desafio", () => {
    expect(findChallenge(cfg, "frase")?.phaseIndex).toBe(1);
    expect(findChallenge(cfg, "nao-existe")).toBeNull();
  });
});
