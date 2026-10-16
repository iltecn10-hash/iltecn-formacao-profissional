"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePicker } from "./file-picker";

export function MaterialsManager({
  assignmentId,
  materials,
}: {
  assignmentId: string;
  materials: { id: string; file_name: string }[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function upload() {
    if (files.length === 0) return;
    setError(null);
    setLoading(true);
    const body = new FormData();
    files.forEach((f) => body.append("files", f));
    const res = await fetch(`/api/assignments/${assignmentId}/materials`, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível anexar.");
      return;
    }
    setFiles([]);
    setPickerKey((k) => k + 1);
    router.refresh();
  }

  async function remove(fileId: string, name: string) {
    if (!window.confirm(`Remover "${name}" dos materiais?`)) return;
    const res = await fetch(`/api/assignments/${assignmentId}/materials/${fileId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível remover.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-5 rounded-lg border border-border bg-primary-light p-4">
      <h3 className="text-sm font-semibold text-foreground">Anexar material para os alunos baixarem</h3>
      {materials.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span>{m.file_name}</span>
              <button type="button" onClick={() => remove(m.id, m.file_name)} className="text-xs text-danger underline">
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <FilePicker key={pickerKey} files={files} onChange={setFiles} />
      </div>
      <p className="mt-2 text-xs text-muted">Até 3 arquivos por vez, 4 MB no total (PDF, Word, Excel, PowerPoint, texto, imagem, ZIP).</p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {files.length > 0 && (
        <button type="button" onClick={upload} disabled={loading} className="btn btn-primary mt-3">
          {loading ? "Enviando…" : "Salvar anexos"}
        </button>
      )}
    </div>
  );
}
