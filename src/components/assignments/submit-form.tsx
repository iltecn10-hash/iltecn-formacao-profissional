"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SubmitAssignmentForm({ assignmentId, hasPrevious }: { assignmentId: string; hasPrevious: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body = new FormData();
    body.set("comment", comment);
    files.forEach((f) => body.append("files", f));
    const res = await fetch(`/api/assignments/${assignmentId}/submit`, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível enviar.");
      return;
    }
    setFiles([]);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {hasPrevious ? "Enviar de novo (substitui os arquivos anteriores)" : "Seus arquivos"}
        </label>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-muted"
        />
        <p className="mt-1 text-xs text-muted">Até 3 arquivos, 4 MB no total.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Recado para o professor (opcional)</label>
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className="field" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Enviando…" : hasPrevious ? "Reenviar" : "Entregar atividade"}
        </button>
      </div>
    </form>
  );
}
