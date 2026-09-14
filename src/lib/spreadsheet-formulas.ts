/**
 * Motor de fórmulas da planilha do aluno (Fase 9.3).
 *
 * Deliberadamente pequeno e sem dependência externa: suporta referências de
 * célula (A1), intervalos (A1:B3), os quatro operadores aritméticos com
 * precedência e parênteses, e um punhado de funções agregadas com nomes em
 * português e inglês (SOMA/SUM, MÉDIA/AVERAGE, MÁXIMO/MAX, MÍNIMO/MIN,
 * CONTAR/COUNT). Não usa `eval`/`Function` em nenhum momento — todo o
 * conteúdo vem do aluno e é tratado como dado não confiável (mesma postura
 * da sanitização em `sanitize-json.ts` para o editor de documentos).
 */

export class FormulaError extends Error {}

const FUNCTION_ALIASES: Record<string, "SUM" | "AVERAGE" | "MAX" | "MIN" | "COUNT"> = {
  SOMA: "SUM",
  SUM: "SUM",
  MEDIA: "AVERAGE",
  "MÉDIA": "AVERAGE",
  AVERAGE: "AVERAGE",
  MAXIMO: "MAX",
  "MÁXIMO": "MAX",
  MAX: "MAX",
  MINIMO: "MIN",
  "MÍNIMO": "MIN",
  MIN: "MIN",
  CONTAR: "COUNT",
  "CONT.VALORES": "COUNT",
  COUNT: "COUNT",
};

interface ColRow {
  col: number;
  row: number;
}

export function colLetterToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function colIndexToLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellKey(col: number, row: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

function parseCellRef(token: string): ColRow | null {
  const m = /^([A-Za-z]+)([0-9]+)$/.exec(token);
  if (!m) return null;
  const row = parseInt(m[2], 10) - 1;
  if (row < 0) return null;
  return { col: colLetterToIndex(m[1]), row };
}

type TokenType =
  | "NUMBER"
  | "WORD"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "LPAREN"
  | "RPAREN"
  | "COLON"
  | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ type: "NUMBER", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-zÀ-ÿ]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-zÀ-ÿ0-9.]/.test(input[j])) j++;
      tokens.push({ type: "WORD", value: input.slice(i, j) });
      i = j;
      continue;
    }
    switch (ch) {
      case "+":
        tokens.push({ type: "PLUS", value: ch });
        i++;
        break;
      case "-":
        tokens.push({ type: "MINUS", value: ch });
        i++;
        break;
      case "*":
        tokens.push({ type: "STAR", value: ch });
        i++;
        break;
      case "/":
        tokens.push({ type: "SLASH", value: ch });
        i++;
        break;
      case "(":
        tokens.push({ type: "LPAREN", value: ch });
        i++;
        break;
      case ")":
        tokens.push({ type: "RPAREN", value: ch });
        i++;
        break;
      case ":":
        tokens.push({ type: "COLON", value: ch });
        i++;
        break;
      case ",":
      case ";":
        tokens.push({ type: "COMMA", value: "," });
        i++;
        break;
      default:
        throw new FormulaError(`Caractere inválido: "${ch}"`);
    }
  }
  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

interface EvalContext {
  getRaw: (col: number, row: number) => string | undefined;
  cache: Map<string, number>;
  visiting: Set<string>;
}

class Parser {
  private pos = 0;
  constructor(
    private tokens: Token[],
    private ctx: EvalContext
  ) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }
  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) {
      throw new FormulaError(`Fórmula inválida: esperado "${type}", encontrado "${t.value}"`);
    }
    return t;
  }

  parseExpression(): number {
    const value = this.parseExpr();
    if (this.peek().type !== "EOF") {
      throw new FormulaError(`Fórmula inválida perto de "${this.peek().value}"`);
    }
    return value;
  }

  private parseExpr(): number {
    let value = this.parseTerm();
    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.next().type;
      const rhs = this.parseTerm();
      value = op === "PLUS" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
      const op = this.next().type;
      const rhs = this.parseUnary();
      if (op === "SLASH") {
        if (rhs === 0) throw new FormulaError("Divisão por zero");
        value = value / rhs;
      } else {
        value = value * rhs;
      }
    }
    return value;
  }

  private parseUnary(): number {
    if (this.peek().type === "MINUS") {
      this.next();
      return -this.parseUnary();
    }
    if (this.peek().type === "PLUS") {
      this.next();
      return this.parseUnary();
    }
    return this.parseAtom();
  }

  private parseAtom(): number {
    const t = this.peek();
    if (t.type === "NUMBER") {
      this.next();
      return parseFloat(t.value);
    }
    if (t.type === "LPAREN") {
      this.next();
      const v = this.parseExpr();
      this.expect("RPAREN");
      return v;
    }
    if (t.type === "WORD") {
      this.next();
      if (this.peek().type === "LPAREN") {
        return this.parseFunctionCall(t.value);
      }
      const ref = parseCellRef(t.value);
      if (!ref) throw new FormulaError(`Referência inválida: "${t.value}"`);
      return this.resolveCell(ref.col, ref.row);
    }
    throw new FormulaError(`Fórmula inválida perto de "${t.value}"`);
  }

  private parseFunctionCall(name: string): number {
    this.expect("LPAREN");
    const fn = FUNCTION_ALIASES[name.toUpperCase()];
    if (!fn) throw new FormulaError(`Função desconhecida: "${name}"`);
    const values: number[] = [];
    if (this.peek().type !== "RPAREN") {
      values.push(...this.parseArg());
      while (this.peek().type === "COMMA") {
        this.next();
        values.push(...this.parseArg());
      }
    }
    this.expect("RPAREN");
    switch (fn) {
      case "SUM":
        return values.reduce((a, b) => a + b, 0);
      case "COUNT":
        return values.length;
      case "AVERAGE":
        if (values.length === 0) throw new FormulaError(`${name}: nenhum valor informado`);
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "MAX":
        if (values.length === 0) throw new FormulaError(`${name}: nenhum valor informado`);
        return Math.max(...values);
      case "MIN":
        if (values.length === 0) throw new FormulaError(`${name}: nenhum valor informado`);
        return Math.min(...values);
    }
  }

  /** Um argumento de função: um intervalo (A1:B3) ou uma expressão qualquer. */
  private parseArg(): number[] {
    if (this.peek().type === "WORD") {
      const wordTok = this.peek();
      const ref = parseCellRef(wordTok.value);
      if (ref) {
        const save = this.pos;
        this.next();
        if (this.peek().type === "COLON") {
          this.next();
          const endTok = this.expect("WORD");
          const endRef = parseCellRef(endTok.value);
          if (!endRef) throw new FormulaError(`Referência inválida: "${endTok.value}"`);
          return this.resolveRange(ref, endRef);
        }
        this.pos = save;
      }
    }
    return [this.parseExpr()];
  }

  private resolveRange(a: ColRow, b: ColRow): number[] {
    const values: number[] = [];
    const colStart = Math.min(a.col, b.col);
    const colEnd = Math.max(a.col, b.col);
    const rowStart = Math.min(a.row, b.row);
    const rowEnd = Math.max(a.row, b.row);
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const raw = this.ctx.getRaw(c, r);
        if (raw === undefined || raw.trim() === "") continue;
        values.push(this.resolveCell(c, r));
      }
    }
    return values;
  }

  private resolveCell(col: number, row: number): number {
    const key = cellKey(col, row);
    const cached = this.ctx.cache.get(key);
    if (cached !== undefined) return cached;
    if (this.ctx.visiting.has(key)) {
      throw new FormulaError(`Referência circular envolvendo ${key}`);
    }
    const raw = this.ctx.getRaw(col, row);
    if (raw === undefined || raw.trim() === "") return 0;
    this.ctx.visiting.add(key);
    try {
      const value = evaluateRaw(raw, this.ctx);
      this.ctx.cache.set(key, value);
      return value;
    } finally {
      this.ctx.visiting.delete(key);
    }
  }
}

/** Avalia um valor bruto de célula (literal ou fórmula) no contexto dado. */
function evaluateRaw(raw: string, ctx: EvalContext): number {
  const trimmed = raw.trim();
  if (trimmed.startsWith("=")) {
    const tokens = tokenize(trimmed.slice(1));
    return new Parser(tokens, ctx).parseExpression();
  }
  const asNumber = Number(trimmed.replace(",", "."));
  if (trimmed !== "" && !Number.isNaN(asNumber)) return asNumber;
  throw new FormulaError(`Valor não numérico: "${trimmed}"`);
}

export interface EvaluatedCell {
  raw: string;
  display: string;
  isFormula: boolean;
  error?: string;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "#ERRO";
  if (Number.isInteger(n)) return String(n);
  // Até 2 casas decimais, sem zeros à direita desnecessários.
  return String(Math.round(n * 100) / 100);
}

/**
 * Avalia a grade inteira de uma vez, com memoização compartilhada entre as
 * células (uma fórmula que soma um intervalo só recalcula cada célula uma
 * vez, mesmo quando várias fórmulas se referenciam entre si).
 */
export function evaluateGrid(
  cells: Record<string, string>,
  rows: number,
  cols: number
): Record<string, EvaluatedCell> {
  const result: Record<string, EvaluatedCell> = {};
  const cache = new Map<string, number>();
  const getRaw = (col: number, row: number) => cells[cellKey(col, row)];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = cellKey(col, row);
      const raw = cells[key] ?? "";
      if (raw.trim() === "") {
        result[key] = { raw, display: "", isFormula: false };
        continue;
      }
      const isFormula = raw.trim().startsWith("=");
      try {
        const ctx: EvalContext = { getRaw, cache, visiting: new Set([key]) };
        const value = evaluateRaw(raw, ctx);
        cache.set(key, value);
        result[key] = { raw, display: formatNumber(value), isFormula };
      } catch (err) {
        if (!isFormula) {
          // Texto literal (não numérico, não fórmula): exibe como digitado.
          result[key] = { raw, display: raw, isFormula: false };
          continue;
        }
        const message = err instanceof FormulaError ? err.message : "Erro na fórmula";
        result[key] = { raw, display: "#ERRO", isFormula: true, error: message };
      }
    }
  }
  return result;
}
