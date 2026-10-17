"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { School } from "@/types";

const inputClass = "field";

export function StudentForm({
  schools,
  classes = [],
}: {
  schools: School[];
  classes?: { id: string; name: string; school_id: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [guardianName, setGuardianName] = useState("");
  const [classId, setClassId] = useState("");
  const [audience, setAudience] = useState<"professional" | "kids">("professional");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!schoolId) {
      setError("Cadastre uma escola antes de adicionar alunos.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        schoolId,
        guardianName,
        audience,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta operação.");
      setLoading(false);
      return;
    }

    // Matrícula opcional na turma escolhida (sem ela o aluno não vê as atividades da turma).
    if (classId && data.student?.id) {
      const enr = await fetch(`/api/classes/${classId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: data.student.id }),
      });
      if (!enr.ok) {
        const e = await enr.json().catch(() => ({}));
        setError(`Aluno cadastrado, mas não foi possível matricular na turma: ${e.error ?? "tente em Turmas → Matricular alunos."}`);
        setLoading(false);
        router.refresh();
        return;
      }
    }

    setName("");
    setEmail("");
    setPassword("");
    setGuardianName("");
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

      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Turma (opcional)
        </label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
          <option value="">Matricular depois</option>
          {classes
            .filter((c) => c.school_id === schoolId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Programa
        </label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as "professional" | "kids")}
          className={inputClass}
        >
          <option value="professional">Formação Profissional</option>
          <option value="kids">ILTECN LAB — Primeiros Passos no Computador (crianças)</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Responsável (opcional)
        </label>
        <input
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
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
          {loading ? "Salvando…" : "Cadastrar aluno"}
        </button>
      </div>
    </form>
  );
}
