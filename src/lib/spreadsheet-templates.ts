/**
 * Modelos pedagógicos de planilha (Fase 9.3, espelhando a seção 5 usada
 * pelos modelos de documento). Cada modelo pré-preenche cabeçalhos e, às
 * vezes, uma fórmula de exemplo — o aluno completa o restante. Uma planilha
 * "livre" (sem modelo) começa em branco.
 */

export type SpreadsheetTemplateKey =
  | "fechamento_caixa"
  | "controle_estoque"
  | "contas_a_pagar"
  | "comparativo_vendas";

export interface SpreadsheetTemplateDef {
  key: SpreadsheetTemplateKey;
  label: string;
  description: string;
  rows: number;
  cols: number;
  cells: Record<string, string>;
}

export const SPREADSHEET_TEMPLATES: SpreadsheetTemplateDef[] = [
  {
    key: "fechamento_caixa",
    label: "Fechamento de Caixa",
    description: "Controle de entradas e saídas do caixa em um dia de trabalho.",
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
  },
  {
    key: "controle_estoque",
    label: "Controle de Estoque",
    description: "Lista de produtos com quantidade, mínimo e alerta de reposição.",
    rows: 18,
    cols: 5,
    cells: {
      A1: "Controle de Estoque",
      A3: "Produto",
      B3: "Quantidade",
      C3: "Estoque mínimo",
      D3: "Preço unitário",
      E3: "Valor em estoque",
      E4: "=B4*D4",
    },
  },
  {
    key: "contas_a_pagar",
    label: "Contas a Pagar da Semana",
    description: "Organização de contas a pagar por vencimento, com total da semana.",
    rows: 16,
    cols: 4,
    cells: {
      A1: "Contas a Pagar da Semana",
      A3: "Descrição",
      B3: "Vencimento",
      C3: "Valor",
      D3: "Pago (Sim/Não)",
      A14: "Total da semana",
      C14: "=SOMA(C4:C13)",
    },
  },
  {
    key: "comparativo_vendas",
    label: "Comparativo de Vendas por Vendedor",
    description: "Comparação simples de vendas entre vendedores, com total e média.",
    rows: 14,
    cols: 3,
    cells: {
      A1: "Comparativo de Vendas por Vendedor",
      A3: "Vendedor",
      B3: "Total vendido",
      A4: "Exemplo",
      B4: "0",
      A11: "Total geral",
      B11: "=SOMA(B4:B10)",
      A12: "Média por vendedor",
      B12: "=MEDIA(B4:B10)",
    },
  },
];

/** Tamanho e conteúdo inicial de uma planilha sem modelo. */
export const FREEFORM_GRID: { rows: number; cols: number } = { rows: 20, cols: 8 };

export function getSpreadsheetTemplate(
  key: string | null | undefined
): SpreadsheetTemplateDef | null {
  if (!key) return null;
  return SPREADSHEET_TEMPLATES.find((t) => t.key === key) ?? null;
}

/** Dimensões e células iniciais para uma planilha nova, com ou sem modelo. */
export function getInitialGrid(key: string | null | undefined): {
  rows: number;
  cols: number;
  cells: Record<string, string>;
} {
  const template = getSpreadsheetTemplate(key);
  if (!template) return { rows: FREEFORM_GRID.rows, cols: FREEFORM_GRID.cols, cells: {} };
  return { rows: template.rows, cols: template.cols, cells: { ...template.cells } };
}
