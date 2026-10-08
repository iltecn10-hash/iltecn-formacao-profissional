import { describe, it, expect } from "vitest";
import {
  gradeActivity,
  scoreFromAttempts,
  toPublicConfig,
  validateActivityConfig,
  deterministicShuffle,
} from "@/lib/lab/activities";
import { computeEvaluation, evaluationLabel, skillStatus } from "@/lib/lab/evaluation";
import { kidsLevel } from "@/lib/levels";
import { generateCertificateCode, shortenName } from "@/modules/lab/queries";

describe("avaliação (30% conhecimento · 50% prática · 20% projeto)", () => {
  it("aplica os pesos e as faixas pedidas", () => {
    expect(computeEvaluation({ knowledge: 100, practice: 100, project: 100 }).score).toBe(100);
    expect(computeEvaluation({ knowledge: 80, practice: 60, project: 100 }).score).toBe(74); // 24+30+20
    expect(evaluationLabel(90)).toBe("Excelente");
    expect(evaluationLabel(89)).toBe("Muito bom");
    expect(evaluationLabel(80)).toBe("Muito bom");
    expect(evaluationLabel(79)).toBe("Bom");
    expect(evaluationLabel(70)).toBe("Bom");
    expect(evaluationLabel(69)).toBe("Em desenvolvimento");
    expect(evaluationLabel(60)).toBe("Em desenvolvimento");
    expect(evaluationLabel(59)).toBe("Precisa praticar");
  });
  it("parte ainda sem resultado conta 0 e marca como parcial", () => {
    const r = computeEvaluation({ knowledge: 100, practice: null, project: null });
    expect(r.score).toBe(30);
    expect(r.partial).toBe(true);
  });
  it("status de habilidade traz sempre texto (não depende só de cor)", () => {
    expect(skillStatus({ completed: 0, total: 5, attempted: 0 })).toBe("not_started");
    expect(skillStatus({ completed: 1, total: 5, attempted: 3 })).toBe("needs_practice");
    expect(skillStatus({ completed: 3, total: 5, attempted: 4 })).toBe("developing");
    expect(skillStatus({ completed: 5, total: 5, attempted: 5 })).toBe("mastered");
  });
});

describe("níveis infantis", () => {
  it("troca de nível nos limites", () => {
    expect(kidsLevel(0).name).toBe("Explorador");
    expect(kidsLevel(299).name).toBe("Explorador");
    expect(kidsLevel(300).name).toBe("Aprendiz");
    expect(kidsLevel(700).name).toBe("Usuário");
    expect(kidsLevel(1200).name).toBe("Criador");
    expect(kidsLevel(1800).name).toBe("Explorador Digital");
    expect(kidsLevel(2500).name).toBe("Mestre Digital");
    expect(kidsLevel(2500).xpToNext).toBeNull();
    expect(kidsLevel(-5).index).toBe(0);
  });
});

describe("correção no servidor", () => {
  const choice = { question: "q", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: ["a"] };
  it("nota cai com tentativas erradas mas nunca abaixo de 40", () => {
    expect([0, 1, 2, 3, 4, 10].map(scoreFromAttempts)).toEqual([100, 80, 60, 40, 40, 40]);
  });
  it("múltipla escolha: marcar tudo não vale", () => {
    const cfg = { ...choice, options: [...choice.options, { id: "c", text: "C" }], answer: ["a", "b"] };
    expect(gradeActivity("choice", cfg, { selected: ["a", "b"] }, "s").correct).toBe(true);
    expect(gradeActivity("choice", cfg, { selected: ["a", "b", "c"] }, "s").correct).toBe(false);
    expect(gradeActivity("choice", cfg, { selected: ["a"] }, "s").correct).toBe(false);
  });
  it("entrada malformada nunca estoura", () => {
    for (const bad of [null, undefined, 42, "x", [], { selected: "a" }, { selected: [1] }]) {
      expect(gradeActivity("choice", choice, bad, "s").correct).toBe(false);
    }
  });
  it("desenho exige traços e cores mínimos", () => {
    const cfg = { minStrokes: 3, minColors: 2 };
    expect(gradeActivity("draw", cfg, { strokes: 3, colors: 2 }, "s").correct).toBe(true);
    expect(gradeActivity("draw", cfg, { strokes: 3, colors: 1 }, "s").correct).toBe(false);
    expect(gradeActivity("draw", cfg, { strokes: -1, colors: 2 }, "s").correct).toBe(false);
  });
  it("digitar: copiar exige texto idêntico; regras livres são checadas", () => {
    const cfg = { fields: [{ id: "n", label: "Nome", mode: "copy", target: "Sol" }] };
    expect(gradeActivity("type", cfg, { values: { n: "Sol" } }, "s").correct).toBe(true);
    expect(gradeActivity("type", cfg, { values: { n: "sol" } }, "s").correct).toBe(false);
    const free = { fields: [{ id: "f", label: "Frase", mode: "free", minWords: 3, mustStartUpper: true, mustEndPunct: true }] };
    expect(gradeActivity("type", free, { values: { f: "Eu amo estudar." } }, "s").correct).toBe(true);
    expect(gradeActivity("type", free, { values: { f: "eu amo estudar." } }, "s").correct).toBe(false);
    expect(gradeActivity("type", free, { values: { f: "Eu amo" } }, "s").correct).toBe(false);
  });
});

describe("configuração pública e validação do admin", () => {
  it("não revela resposta de arrastar, ordem nem metas de arquivos", () => {
    const drag = { items: [{ id: "i1", label: "x" }, { id: "i2", label: "y" }], zones: [{ id: "z1", label: "A" }, { id: "z2", label: "B" }], answer: { i1: "z1", i2: "z2" } };
    expect(JSON.stringify(toPublicConfig("drag", drag, "s"))).not.toContain("answer");
    const order = toPublicConfig("order", { items: ["1", "2", "3", "4"] }, "semente") as { items: string[] };
    expect([...order.items].sort()).toEqual(["1", "2", "3", "4"]);
    const files = { initialFolders: [], initialFiles: [], instructions: ["faça"], goals: [{ type: "folder_exists", path: "A" }] };
    expect(JSON.stringify(toPublicConfig("files", files, "s"))).not.toContain("goals");
    const type = { fields: [{ id: "f", label: "L", mode: "free", target: "segredo" }] };
    expect(JSON.stringify(toPublicConfig("type", type, "s"))).not.toContain("segredo");
  });
  it("embaralhar é determinístico por semente", () => {
    const a = deterministicShuffle([1, 2, 3, 4, 5, 6], "x");
    expect(deterministicShuffle([1, 2, 3, 4, 5, 6], "x")).toEqual(a);
  });
  it("admin não consegue salvar atividade inconsistente", () => {
    expect(validateActivityConfig("choice", { question: "q", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: ["z"] })).toBeTruthy();
    expect(validateActivityConfig("choice", { question: "q", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: ["a"] })).toBeNull();
    expect(validateActivityConfig("order", { items: ["só um"] })).toBeTruthy();
    expect(validateActivityConfig("nao_existe", {})).toBeTruthy();
  });
});

describe("certificado", () => {
  it("código legível e único o bastante", () => {
    const codes = new Set(Array.from({ length: 200 }, generateCertificateCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^ILT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it("nome público reduzido", () => {
    expect(shortenName("Maria Aparecida Souza")).toBe("Maria S.");
    expect(shortenName("Ana")).toBe("Ana");
    expect(shortenName("  ")).toBe("");
  });
});
