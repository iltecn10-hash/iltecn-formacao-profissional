/** Classes compartilhadas do ILTECN LAB: botões grandes, cantos arredondados, alto contraste. */
export const bigBtn =
  "min-h-12 rounded-2xl px-5 py-3 text-base font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50";
export const primaryBtn = `${bigBtn} bg-primary text-white hover:bg-primary-dark`;
export const softBtn = `${bigBtn} border-2 border-border bg-surface text-foreground hover:border-primary hover:bg-primary-light`;
export const chip =
  "inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-sm font-semibold text-primary-dark";

/** Contrato de cada atividade interativa: recebe a config pública e entrega a resposta. */
export interface ActivityProps<C = Record<string, unknown>> {
  config: C;
  disabled?: boolean;
  onSubmit: (submission: unknown) => void;
}
