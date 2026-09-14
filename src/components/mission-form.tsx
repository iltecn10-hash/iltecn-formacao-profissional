"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CourseModule, Competency } from "@/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function MissionForm({
  modules,
  competencies,
}: {
  modules: CourseModule[];
  competencies: Competency[];
}) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [objective, setObjective] = useState("");
  const [pointsValue, setPointsValue] = useState(100);
  const [resourceUrl, setResourceUrl] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleCompetency(id: string) {
    setSelectedCompetencies((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!moduleId) {
      setError("Crie um módulo antes de adicionar missões.");
      return;
    }

    setLoading(true);
    const tasks = tasksText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        title,
        context,
        objective,
        pointsValue,
        resourceUrl,
        tasks,
        competencyIds: selectedCompetencies,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta operação.");
      setLoading(false);
      return;
    }

    setTitle("");
    setContext("");
    setObjective("");
    setResourceUrl("");
    setTasksText("");
    setSelectedCompetencies([]);
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Módulo
        </label>
        <select
          required
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          className={inputClass}
        >
          {modules.length === 0 && <option value="">Nenhum módulo cadastrado</option>}
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Título da missão
        </label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Relatório de Vendas do Mês"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Contexto (situação profissional)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          placeholder="Ex: O gerente solicitou um relatório das vendas realizadas no mês."
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Objetivo
        </label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Pontuação
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={pointsValue}
            onChange={(e) => setPointsValue(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Link do arquivo modelo (opcional)
        </label>
        <input
          type="url"
          value={resourceUrl}
          onChange={(e) => setResourceUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">
          Link para a planilha, documento ou modelo que o aluno vai usar. O
          ILTECN não recria o Word/Excel — apenas disponibiliza o arquivo.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Tarefas (uma por linha)
        </label>
        <textarea
          value={tasksText}
          onChange={(e) => setTasksText(e.target.value)}
          rows={4}
          placeholder={"Abrir a planilha fornecida\nOrganizar os dados\nCalcular o total"}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Competências trabalhadas
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          {competencies.map((c) => {
            const active = selectedCompetencies.includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => toggleCompetency(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-primary bg-primary-light text-primary-dark"
                    : "border-border text-muted hover:bg-background"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Criar missão"}
      </button>
    </form>
  );
}
