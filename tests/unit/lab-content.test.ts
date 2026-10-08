import { describe, expect, it } from "vitest";
import { validateActivityConfig } from "@/lib/lab/activities";
import { LAB_LESSONS, LAB_MODULES, FINAL_LESSON_NUMBER } from "@/lib/lab/content";
import { LAB_ACHIEVEMENTS } from "@/lib/lab/content/achievements";
import { kidsLevel } from "@/lib/levels";

const activities = LAB_LESSONS.flatMap((l) => l.activities.map((a) => ({ ...a, lesson: l.number })));

describe("conteúdo do ILTECN LAB", () => {
  it("tem 6 módulos e 30 aulas numeradas de 1 a 30", () => {
    expect(LAB_MODULES).toHaveLength(6);
    expect(LAB_LESSONS).toHaveLength(30);
    expect(LAB_LESSONS.map((l) => l.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("distribui as aulas como o programa pede (4/5/5/6/6/4)", () => {
    expect(LAB_MODULES.map((m) => m.lessons.length)).toEqual([4, 5, 5, 6, 6, 4]);
  });

  it("toda aula tem explicação, objetivo, passo a passo e ao menos uma atividade", () => {
    for (const l of LAB_LESSONS) {
      expect(l.context.length, `aula ${l.number} sem contexto`).toBeGreaterThan(20);
      expect(l.objective.length, `aula ${l.number} sem objetivo`).toBeGreaterThan(5);
      expect(l.steps.length, `aula ${l.number} sem passos`).toBeGreaterThan(0);
      expect(l.activities.length, `aula ${l.number} sem atividades`).toBeGreaterThan(0);
    }
  });

  it("todas as atividades têm configuração válida e consistente", () => {
    for (const a of activities) {
      expect(validateActivityConfig(a.kind, a.config), `${a.code} (${a.kind})`).toBeNull();
    }
  });

  it("os códigos das atividades são únicos", () => {
    const codes = activities.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("só as aulas de texto e o projeto exigem documento (22, 23 e 26)", () => {
    expect(LAB_LESSONS.filter((l) => l.document).map((l) => l.number)).toEqual([22, 23, 26]);
  });

  it("a aula final é a 30 e vale o maior prêmio", () => {
    const final = LAB_LESSONS.find((l) => l.number === FINAL_LESSON_NUMBER)!;
    expect(final.points).toBe(Math.max(...LAB_LESSONS.map((l) => l.points)));
    expect(final.activities.every((a) => a.category === "challenge")).toBe(true);
  });

  it("o XP total do programa leva o aluno ao nível Mestre Digital só no final", () => {
    const total =
      activities.reduce((s, a) => s + a.xp, 0) + LAB_LESSONS.reduce((s, l) => s + l.points, 0);
    const beforeFinal =
      activities.filter((a) => a.lesson !== 30).reduce((s, a) => s + a.xp, 0) +
      LAB_LESSONS.filter((l) => l.number !== 30).reduce((s, l) => s + l.points, 0);
    expect(kidsLevel(total).name).toBe("Mestre Digital");
    expect(kidsLevel(beforeFinal).name).not.toBe("Mestre Digital");
  });

  it("as conquistas apontam para aulas que existem", () => {
    const numbers = new Set(LAB_LESSONS.map((l) => l.number));
    for (const a of LAB_ACHIEVEMENTS) {
      if (a.criteria.type === "mission_completed") expect(numbers.has(a.criteria.lesson)).toBe(true);
      if (a.criteria.type === "skill_completed") expect(numbers.has(a.criteria.uptoLesson)).toBe(true);
    }
    expect(new Set(LAB_ACHIEVEMENTS.map((a) => a.code)).size).toBe(LAB_ACHIEVEMENTS.length);
  });
});
