"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { School } from "@/types";

export function CoordinationForm({ schools }: { schools: School[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState<"coordenador" | "diretor">("coordenador");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!schoolId) {
      setError("Cadastre uma escola antes de adicionar coordenação ou direção.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/coordination", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, schoolId, position }),
    });
    const data = await res.json().catch(() => ({}));
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
        <label className="mb-1.5 block text-sm font-medium text-foreground">Cargo</label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value as "coordenador" | "diretor")}
          className="field"
        >
          <option value="coordenador">Coordenador</option>
          <option value="diretor">Diretor</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Escola</label>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="field">
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Nome completo</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">E-mail (login)</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">Senha provisória</label>
        <input required type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
        <p className="mt-1 text-xs text-muted">
          Mínimo de 8 caracteres, com letra e número. A pessoa pode trocar em &quot;Minha conta&quot;.
        </p>
      </div>
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Salvando…" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}
