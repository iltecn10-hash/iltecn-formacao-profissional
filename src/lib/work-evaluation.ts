/**
 * Avaliação automática de trabalhos do aluno (Fase 9.5).
 *
 * Deliberadamente simples e sobre *completude/estrutura*, não sobre qualidade
 * de redação: para documentos, confere se os campos obrigatórios do modelo
 * foram preenchidos; para planilhas, confere se o aluno preencheu dados além
 * do esqueleto do modelo e se as fórmulas (as do modelo e as que o aluno
 * escreveu) calculam sem erro. Roda uma vez, no momento da entrega
 * (`submitStudentWork`), e fica registrada em `work_evaluations` com
 * `evaluation_type = 'AUTO'` — a avaliação manual do professor (Fase 9.6) é
 * um registro separado, do mesmo jeito.
 */

import type { DocumentWorkContent, SpreadsheetWorkContent, WorkType } from "@/types";
import { getFieldDefs } from "@/lib/document-templates";
import { getSpreadsheetTemplate } from "@/lib/spreadsheet-templates";
import { evaluateGrid } from "@/lib/spreadsheet-formulas";

export interface AutoEvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  details: Record<string, unknown>;
}

/**
 * Um nó de documento Tiptap tem conteúdo de verdade se existir, em qualquer
 * profundidade, um nó de texto não vazio (parágrafo vazio vira `<p></p>`,
 * sem nó de texto nenhum).
 */
function richTextHasContent(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const obj = node as { type?: string; text?: string; content?: unknown[] };
  if (obj.type === "text" && typeof obj.text === "string" && obj.text.trim().length > 0) {
    return true;
  }
  if (Array.isArray(obj.content)) {
    return obj.content.some((child) => richTextHasContent(child));
  }
  return false;
}

function evaluateDocumentWork(
  templateKey: string | null,
  content: DocumentWorkContent
): AutoEvaluationResult {
  const fieldDefs = getFieldDefs(templateKey);
  // Campo sem `required` explícito conta como obrigatório para fins de
  // avaliação (cobre o campo único do documento livre, que não marca
  // `required` por não ter modelo pedagógico associado).
  const requiredFields = fieldDefs.filter((f) => f.required !== false);

  const missing: string[] = [];
  for (const field of requiredFields) {
    const filled =
      field.kind === "richtext"
        ? richTextHasContent(content.rich?.[field.key])
        : (content.fields?.[field.key] ?? "").trim().length > 0;
    if (!filled) missing.push(field.label);
  }

  const total = requiredFields.length;
  const filledCount = total - missing.length;
  const score = total === 0 ? 100 : Math.round((filledCount / total) * 100);
  const passed = missing.length === 0;

  const feedback = passed
    ? "Todos os campos obrigatórios foram preenchidos."
    : `Campos obrigatórios não preenchidos: ${missing.join(", ")}.`;

  return {
    score,
    passed,
    feedback,
    details: { requiredFields: total, filledFields: filledCount, missing },
  };
}

function evaluateSpreadsheetWork(
  templateKey: string | null,
  content: SpreadsheetWorkContent
): AutoEvaluationResult {
  const template = getSpreadsheetTemplate(templateKey);
  const skeleton = template?.cells ?? {};

  // Células que o aluno preencheu ou alterou além do esqueleto do modelo
  // (cabeçalhos e fórmula de exemplo) — ou, numa planilha livre, todas as
  // células preenchidas.
  const studentDataKeys = Object.keys(content.cells ?? {}).filter(
    (key) => skeleton[key] === undefined || skeleton[key] !== content.cells[key]
  );

  const evaluated = evaluateGrid(content.cells ?? {}, content.rows, content.cols);
  const formulaKeys = Object.keys(evaluated).filter((key) => evaluated[key].isFormula);
  const errorKeys = formulaKeys.filter((key) => evaluated[key].error);

  const MIN_DATA_CELLS = 3;
  const hasMinData = studentDataKeys.length >= MIN_DATA_CELLS;
  const noFormulaErrors = errorKeys.length === 0;

  const dataScore = Math.min(1, studentDataKeys.length / MIN_DATA_CELLS) * 60;
  const formulaScore =
    formulaKeys.length === 0
      ? 40
      : Math.round(40 * (1 - errorKeys.length / formulaKeys.length));
  const score = Math.round(dataScore + formulaScore);
  const passed = hasMinData && noFormulaErrors;

  const parts: string[] = [];
  if (!hasMinData) {
    parts.push(
      `Preencha pelo menos ${MIN_DATA_CELLS} células com dados próprios (só ${studentDataKeys.length} até agora).`
    );
  }
  if (!noFormulaErrors) {
    parts.push(
      `${errorKeys.length} fórmula(s) com erro: ${errorKeys.join(", ")}.`
    );
  }
  const feedback =
    parts.length === 0
      ? "Planilha preenchida com dados próprios e sem erros de fórmula."
      : parts.join(" ");

  return {
    score,
    passed,
    feedback,
    details: {
      studentDataCells: studentDataKeys.length,
      formulaCells: formulaKeys.length,
      formulaErrors: errorKeys.length,
      errorCells: errorKeys,
    },
  };
}

/**
 * Avalia automaticamente o conteúdo de um trabalho no momento da entrega.
 * Sempre retorna um resultado (mesmo sem modelo pedagógico associado) — a
 * régua muda (completude de campos vs. dados+fórmulas), mas há sempre algo
 * objetivo para medir.
 */
export function evaluateStudentWork(
  workType: WorkType,
  templateKey: string | null,
  content: Record<string, unknown>
): AutoEvaluationResult {
  if (workType === "DOCUMENT") {
    return evaluateDocumentWork(templateKey, content as unknown as DocumentWorkContent);
  }
  return evaluateSpreadsheetWork(templateKey, content as unknown as SpreadsheetWorkContent);
}
