"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Supplier, Customer } from "@/types";

const inputClass = "field";

export function FinanceForm({
  type,
  suppliers,
  customers,
}: {
  type: "payable" | "receivable";
  suppliers: Supplier[];
  customers: Customer[];
}) {
  const router = useRouter();
  const [partyId, setPartyId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const options = type === "payable" ? suppliers : customers;
  const label = type === "payable" ? "Fornecedor" : "Cliente";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const body =
      type === "payable"
        ? { supplierId: partyId || undefined, description, dueDate, amount: Number(amount) }
        : { customerId: partyId || undefined, description, dueDate, amount: Number(amount) };

    const res = await fetch(`/api/supermarket/finance/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta operação.");
      setLoading(false);
      return;
    }

    setDescription("");
    setDueDate("");
    setAmount("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
        <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className={inputClass}>
          <option value="">Não informado</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Vencimento</label>
        <input
          required
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-foreground">Descrição</label>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Valor (R$)</label>
        <input
          required
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
          {loading ? "Salvando…" : "Adicionar conta"}
        </button>
      </div>
    </form>
  );
}
