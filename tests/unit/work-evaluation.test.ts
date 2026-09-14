import { describe, it, expect } from "vitest";
import { evaluateStudentWork as evaluateStudentWorkRaw } from "@/lib/work-evaluation";
import type { DocumentWorkContent, SpreadsheetWorkContent, WorkType } from "@/types";

// `student_works.content` chega do banco como `Record<string, unknown>` — os
// testes usam os tipos concretos (mais seguros de escrever), então convertem
// aqui no único lugar que precisa saber disso.
function evaluateStudentWork(
  workType: WorkType,
  templateKey: string | null,
  content: DocumentWorkContent | SpreadsheetWorkContent
) {
  return evaluateStudentWorkRaw(workType, templateKey, content as unknown as Record<string, unknown>);
}

function richText(text: string): Record<string, unknown> {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

const EMPTY_RICH: Record<string, unknown> = { type: "doc", content: [{ type: "paragraph" }] };

describe("evaluateStudentWork — documentos (Fase 9.5)", () => {
  it("reprova um memorando com campos obrigatórios vazios", () => {
    const content: DocumentWorkContent = {
      fields: { numero: "012/2026" },
      rich: { conteudo: EMPTY_RICH },
    };
    const result = evaluateStudentWork("DOCUMENT", "memorando", content);

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(100);
    expect(result.feedback).toContain("Data");
    expect(result.details.missing).toContain("Conteúdo");
  });

  it("aprova um memorando com todos os campos obrigatórios preenchidos", () => {
    const content: DocumentWorkContent = {
      fields: {
        numero: "012/2026",
        data: "2026-09-14",
        destinatario: "Equipe",
        remetente: "RH",
        assunto: "Horário de almoço",
      },
      rich: { conteudo: richText("O horário de almoço muda a partir de segunda-feira.") },
    };
    const result = evaluateStudentWork("DOCUMENT", "memorando", content);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details.missing).toEqual([]);
  });

  it("um espaço em branco não conta como campo preenchido", () => {
    const content: DocumentWorkContent = {
      fields: { requerente: "   " },
      rich: {},
    };
    const result = evaluateStudentWork("DOCUMENT", "requerimento", content);
    expect(result.details.missing).toContain("Requerente");
  });

  it("documento livre (sem modelo) é avaliado pelo único campo de corpo", () => {
    const vazio = evaluateStudentWork("DOCUMENT", null, { fields: {}, rich: {} });
    expect(vazio.passed).toBe(false);

    const preenchido = evaluateStudentWork("DOCUMENT", null, {
      fields: {},
      rich: { body: richText("Texto livre qualquer.") },
    });
    expect(preenchido.passed).toBe(true);
  });
});

describe("evaluateStudentWork — planilhas (Fase 9.5)", () => {
  it("reprova uma planilha só com o esqueleto do modelo, sem dados do aluno", () => {
    const content: SpreadsheetWorkContent = {
      rows: 16,
      cols: 4,
      cells: {
        A1: "Fechamento de Caixa",
        A3: "Descrição",
        B3: "Tipo (Entrada/Saída)",
        C3: "Valor",
        A4: "Saldo inicial",
        B4: "Entrada",
        C4: "0",
        A14: "Total",
        C14: "=SOMA(C4:C13)",
      },
    };
    const result = evaluateStudentWork("SPREADSHEET", "fechamento_caixa", content);
    expect(result.passed).toBe(false);
    expect(result.feedback).toMatch(/pelo menos 3 células/);
  });

  it("aprova quando o aluno preenche dados próprios e as fórmulas calculam sem erro", () => {
    const content: SpreadsheetWorkContent = {
      rows: 16,
      cols: 4,
      cells: {
        A1: "Fechamento de Caixa",
        A3: "Descrição",
        B3: "Tipo (Entrada/Saída)",
        C3: "Valor",
        A4: "Saldo inicial",
        B4: "Entrada",
        C4: "100",
        A5: "Venda 1",
        B5: "Entrada",
        C5: "50",
        A6: "Troco",
        B6: "Saída",
        C6: "20",
        A14: "Total",
        C14: "=SOMA(C4:C13)",
      },
    };
    const result = evaluateStudentWork("SPREADSHEET", "fechamento_caixa", content);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details.formulaErrors).toBe(0);
  });

  it("reprova quando alguma fórmula do aluno dá erro (ex: divisão por zero)", () => {
    const content: SpreadsheetWorkContent = {
      rows: 16,
      cols: 4,
      cells: {
        A1: "Fechamento de Caixa",
        A4: "Item 1",
        B4: "10",
        C4: "0",
        D4: "=B4/C4",
      },
    };
    const result = evaluateStudentWork("SPREADSHEET", "fechamento_caixa", content);
    expect(result.passed).toBe(false);
    expect(result.details.formulaErrors).toBeGreaterThan(0);
    expect(result.feedback).toMatch(/erro/);
  });

  it("planilha livre (sem modelo) conta todas as células preenchidas como dados do aluno", () => {
    const content: SpreadsheetWorkContent = {
      rows: 20,
      cols: 8,
      cells: { A1: "x", A2: "y", A3: "z" },
    };
    const result = evaluateStudentWork("SPREADSHEET", null, content);
    expect(result.details.studentDataCells).toBe(3);
    expect(result.passed).toBe(true);
  });
});
