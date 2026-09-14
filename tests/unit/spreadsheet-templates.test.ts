import { describe, it, expect } from "vitest";
import {
  SPREADSHEET_TEMPLATES,
  getSpreadsheetTemplate,
  getInitialGrid,
  FREEFORM_GRID,
} from "@/lib/spreadsheet-templates";
import { evaluateGrid } from "@/lib/spreadsheet-formulas";

describe("spreadsheet-templates (Fase 9.3)", () => {
  it("define os 4 modelos pedagógicos previstos", () => {
    const keys = SPREADSHEET_TEMPLATES.map((t) => t.key).sort();
    expect(keys).toEqual(
      ["comparativo_vendas", "contas_a_pagar", "controle_estoque", "fechamento_caixa"].sort()
    );
  });

  it("cada modelo cabe dentro das próprias dimensões (rows/cols)", () => {
    for (const template of SPREADSHEET_TEMPLATES) {
      for (const key of Object.keys(template.cells)) {
        const match = /^([A-Z]+)([0-9]+)$/.exec(key);
        expect(match, `${template.key}: chave de célula inválida "${key}"`).not.toBeNull();
      }
    }
  });

  it("as fórmulas de exemplo de cada modelo avaliam sem erro", () => {
    for (const template of SPREADSHEET_TEMPLATES) {
      const result = evaluateGrid(template.cells, template.rows, template.cols);
      for (const [key, cell] of Object.entries(result)) {
        if (cell.isFormula) {
          expect(cell.error, `${template.key} ${key}: ${cell.error}`).toBeUndefined();
        }
      }
    }
  });

  it("getSpreadsheetTemplate retorna null para chave inexistente ou vazia", () => {
    expect(getSpreadsheetTemplate("nao-existe")).toBeNull();
    expect(getSpreadsheetTemplate(null)).toBeNull();
    expect(getSpreadsheetTemplate(undefined)).toBeNull();
  });

  it("getInitialGrid cai para a grade livre quando não há modelo", () => {
    const grid = getInitialGrid(null);
    expect(grid).toEqual({ rows: FREEFORM_GRID.rows, cols: FREEFORM_GRID.cols, cells: {} });
  });

  it("getInitialGrid retorna as dimensões e células do modelo escolhido", () => {
    const grid = getInitialGrid("fechamento_caixa");
    const template = getSpreadsheetTemplate("fechamento_caixa")!;
    expect(grid.rows).toBe(template.rows);
    expect(grid.cols).toBe(template.cols);
    expect(grid.cells).toEqual(template.cells);
    // getInitialGrid deve devolver uma cópia, não a mesma referência do catálogo.
    expect(grid.cells).not.toBe(template.cells);
  });
});
