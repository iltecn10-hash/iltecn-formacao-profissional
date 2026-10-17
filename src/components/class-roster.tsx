"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Person {
  student_id: string;
  name: string;
  email: string;
}

export function ClassRoster({
  classId,
  className,
  enrolled,
  available,
}: {
  classId: string;
  className: string;
  enrolled: Person[];
  available: Person[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE", studentId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/classes/${classId}/enrollments${method === "DELETE" ? `?studentId=${studentId}` : ""}`,
      {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify({ studentId }) : undefined,
      }
    );
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir.");
      return;
    }
    setChoice("");
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="card p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Matricular aluno na turma {className}</h2>
        {available.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Não há mais alunos da escola para matricular. Cadastre o aluno na tela <strong>Alunos</strong> primeiro.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select value={choice} onChange={(e) => setChoice(e.target.value)} className="field">
              <option value="">Escolha o aluno…</option>
              {available.map((p) => (
                <option key={p.student_id} value={p.student_id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
            <button type="button" disabled={!choice || busy} onClick={() => call("POST", choice)} className="btn btn-primary">
              {busy ? "Salvando…" : "Matricular"}
            </button>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      <div className="card p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Alunos matriculados ({enrolled.length})</h2>
        {enrolled.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum aluno matriculado ainda. Só alunos matriculados veem as atividades da turma.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {enrolled.map((p) => (
              <li key={p.student_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-foreground">{p.name}</span>{" "}
                  <span className="text-muted">{p.email}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => window.confirm(`Remover ${p.name} da turma?`) && call("DELETE", p.student_id)}
                  className="btn btn-secondary"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
