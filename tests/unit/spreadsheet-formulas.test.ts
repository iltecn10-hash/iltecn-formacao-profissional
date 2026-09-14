import { describe, it, expect } from "vitest";
import { evaluateGrid, colIndexToLetter, colLetterToIndex, cellKey } from "@/lib/spreadsheet-formulas";

describe("spreadsheet-formulas (Fase 9.3)", () => {
  it("colIndexToLetter/colLetterToIndex são inversas para colunas simples e duplas", () => {
    expect(colIndexToLetter(0)).toBe("A");
    expect(colIndexToLetter(25)).toBe("Z");
    expect(colIndexToLetter(26)).toBe("AA");
    expect(colLetterToIndex("A")).toBe(0);
    expect(colLetterToIndex("Z")).toBe(25);
    expect(colLetterToIndex("AA")).toBe(26);
  });

  it("cellKey monta a referência estilo A1", () => {
    expect(cellKey(0, 0)).toBe("A1");
    expect(cellKey(1, 9)).toBe("B10");
  });

  it("exibe literais numéricos e de texto sem alteração de fórmula", () => {
    const result = evaluateGrid({ A1: "10", B1: "texto" }, 1, 2);
    expect(result.A1.display).toBe("10");
    expect(result.A1.isFormula).toBe(false);
    expect(result.B1.display).toBe("texto");
    expect(result.B1.isFormula).toBe(false);
  });

  it("avalia operadores aritméticos com precedência e parênteses", () => {
    const result = evaluateGrid({ A1: "=2+3*4", A2: "=(2+3)*4" }, 2, 1);
    expect(result.A1.display).toBe("14");
    expect(result.A2.display).toBe("20");
  });

  it("resolve referências de célula, inclusive encadeadas", () => {
    const result = evaluateGrid({ A1: "10", B1: "=A1+5", C1: "=B1*2" }, 1, 3);
    expect(result.B1.display).toBe("15");
    expect(result.C1.display).toBe("30");
  });

  it("trata célula vazia referenciada como zero", () => {
    const result = evaluateGrid({ B1: "=A1+1" }, 1, 2);
    expect(result.B1.display).toBe("1");
  });

  it("SOMA/SUM e MEDIA/AVERAGE calculam sobre um intervalo", () => {
    const cells = { A1: "1", A2: "2", A3: "3" };
    const result = evaluateGrid(
      { ...cells, B1: "=SOMA(A1:A3)", B2: "=MEDIA(A1:A3)", B3: "=SUM(A1:A3)" },
      3,
      2
    );
    expect(result.B1.display).toBe("6");
    expect(result.B2.display).toBe("2");
    expect(result.B3.display).toBe("6");
  });

  it("MAXIMO/MAX e MINIMO/MIN calculam sobre um intervalo", () => {
    const cells = { A1: "5", A2: "1", A3: "9" };
    const result = evaluateGrid({ ...cells, B1: "=MAXIMO(A1:A3)", B2: "=MINIMO(A1:A3)" }, 3, 2);
    expect(result.B1.display).toBe("9");
    expect(result.B2.display).toBe("1");
  });

  it("ignora células vazias dentro de um intervalo agregado", () => {
    const result = evaluateGrid({ A1: "2", A3: "4", B1: "=SOMA(A1:A3)" }, 3, 2);
    expect(result.B1.display).toBe("6");
  });

  it("SOMA de um intervalo totalmente vazio resulta em 0, sem erro", () => {
    const result = evaluateGrid({ B1: "=SOMA(A1:A5)" }, 5, 2);
    expect(result.B1.display).toBe("0");
    expect(result.B1.error).toBeUndefined();
  });

  it("MEDIA de um intervalo vazio retorna #ERRO em vez de dividir por zero", () => {
    const result = evaluateGrid({ B1: "=MEDIA(A1:A5)" }, 5, 2);
    expect(result.B1.display).toBe("#ERRO");
  });

  it("retorna #ERRO em divisão por zero", () => {
    const result = evaluateGrid({ A1: "=1/0" }, 1, 1);
    expect(result.A1.display).toBe("#ERRO");
    expect(result.A1.error).toMatch(/divisão/i);
  });

  it("retorna #ERRO em referência circular, sem travar", () => {
    const result = evaluateGrid({ A1: "=B1+1", B1: "=A1+1" }, 1, 2);
    expect(result.A1.display).toBe("#ERRO");
    expect(result.A1.error).toMatch(/circular/i);
  });

  it("retorna #ERRO ao usar uma célula de texto em uma conta", () => {
    const result = evaluateGrid({ A1: "abc", B1: "=A1+1" }, 1, 2);
    expect(result.B1.display).toBe("#ERRO");
  });

  it("formata resultados decimais sem casas desnecessárias", () => {
    const result = evaluateGrid({ A1: "10", A2: "4", B1: "=A1/A2" }, 2, 2);
    expect(result.B1.display).toBe("2.5");
  });
});
