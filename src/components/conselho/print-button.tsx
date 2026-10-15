"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-background print:hidden"
    >
      Imprimir / salvar em PDF
    </button>
  );
}
