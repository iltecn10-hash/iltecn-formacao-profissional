"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { School, Teacher } from "@/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const currentYear = new Date().getFullYear();

export function ClassForm({
  schools,
  teachers,
}: {
  schools: School[];
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState("");
  const [shift, setShift] = useState<"manha" | "tarde" | "noite" | "integral">(
    "manha"
  );
  const [schoolYear, setSchoolYear] = useState(currentYear);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!schoolId) {
      setError("Cadastre uma escola antes de criar turmas.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        schoolId,
        teacherId: teacherId || undefined,
        shift,
        schoolYear,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta operação.");
      setLoading(false);
      return;
    }

    setName("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Nome da turma
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Turma A - Manhã"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Escola
        </label>
        <select
          required
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className={inputClass}
        >
          {schools.length === 0 && <option value="">Nenhuma escola cadastrada</option>}
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Professor responsável
        </label>
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className={inputClass}
        >
          <option value="">Sem professor definido</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Turno
        </label>
        <select
          value={shift}
          onChange={(e) => setShift(e.target.value as typeof shift)}
          className={inputClass}
        >
          <option value="manha">Manhã</option>
          <option value="tarde">Tarde</option>
          <option value="noite">Noite</option>
          <option value="integral">Integral</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Ano letivo
        </label>
        <input
          type="number"
          required
          value={schoolYear}
          onChange={(e) => setSchoolYear(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      {error && (
        <p className="sm:col-span-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? "Salvando…" : "Criar turma"}
        </button>
      </div>
    </form>
  );
}
