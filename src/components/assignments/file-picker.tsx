"use client";

import { useRef } from "react";

/** Botão grande e visível para escolher arquivos (o campo nativo do navegador passa despercebido no celular). */
export function FilePicker({
  files,
  onChange,
  label = "Anexar arquivos",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
      />
      <button type="button" onClick={() => ref.current?.click()} className="btn btn-secondary">
        📎 {files.length > 0 ? "Trocar arquivos" : label}
      </button>
      {files.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground">
          {files.map((f) => (
            <li key={f.name + f.size}>✔ {f.name}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Nenhum arquivo escolhido.</p>
      )}
    </div>
  );
}
