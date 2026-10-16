"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FilePicker } from "./file-picker";

export function AssignmentForm({
  classes,
  onCreated,
}: {
  classes: { id: string; name: string }[];
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!classId) {
      setError("Você ainda não tem turma. Peça ao administrador para vincular você a uma turma.");
      return;
    }
    setLoading(true);
    const body = new FormData();
    body.set("classId", classId);
    body.set("title", title);
    body.set("instructions", instructions);
    if (dueDate) body.set("dueDate", dueDate);
    files.forEach((f) => body.append("files", f));
    const res = await fetch("/api/assignments", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível criar a atividade.");
      return;
    }
    setTitle("");
    setInstructions("");
    setDueDate("");
    setFiles([]);
    router.refresh();
    onCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Turma</label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="field">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Prazo de entrega (opcional)</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">Título da atividade</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">Instruções</label>
        <textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Materiais para os alunos baixarem (opcional)
        </label>
        <FilePicker files={files} onChange={setFiles} />
        <p className="mt-1 text-xs text-muted">
          Até 3 arquivos, 4 MB no total. Aceitos: PDF, Word, Excel, PowerPoint, texto, imagem e ZIP.
        </p>
      </div>
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Criando…" : "Criar atividade"}
        </button>
      </div>
    </form>
  );
}
