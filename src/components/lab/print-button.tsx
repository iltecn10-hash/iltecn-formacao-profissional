"use client";

import { primaryBtn } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${primaryBtn} mt-3`}>
      🖨️ Imprimir / salvar em PDF
    </button>
  );
}
