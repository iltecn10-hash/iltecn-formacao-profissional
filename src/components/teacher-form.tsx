"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { School } from "@/types";

const inputClass = "field";

export function TeacherForm({ schools }: { schools: School[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!schoolId) {
      setError("Cadastre uma escola antes de adicionar professores.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, schoolId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta operação.");
      setLoading(false);
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Nome completo
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          E-mail
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Senha provisória
        </label>
        <input
          required
          type="text"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className={inputClass}
        />
      </div>

      {error && (
        <p className="sm:col-span-2 rounded-md bg-danger-light px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? "Salvando…" : "Cadastrar professor"}
        </button>
      </div>
    </form>
  );
}
