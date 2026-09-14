import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  listAccountsPayable,
  listAccountsReceivable,
  getFinancialIndicators,
} from "@/modules/supermarket/finance";
import { listSuppliers, listCustomers } from "@/modules/supermarket/products";
import { FinanceForm } from "@/components/finance-form";
import { StatCard } from "@/components/stat-card";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const statusStyle: Record<string, string> = {
  pendente: "bg-accent-light text-accent",
  pago: "bg-primary-light text-primary-dark",
  recebido: "bg-primary-light text-primary-dark",
  vencido: "bg-danger/10 text-danger",
};

export default async function FinanceiroPage() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    redirect("/dashboard");
  }

  const [payable, receivable, indicators, suppliers, customers] = await Promise.all([
    listAccountsPayable(),
    listAccountsReceivable(),
    getFinancialIndicators(),
    listSuppliers(),
    listCustomers(),
  ]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Financeiro — Supermercado Bom Preço
      </h1>
      <p className="mt-1 text-muted">Contas a pagar e a receber (valores simulados).</p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total recebido" value={formatBRL(indicators.totalReceived)} />
        <StatCard label="Total pago" value={formatBRL(indicators.totalPaid)} />
        <StatCard label="Saldo simulado" value={formatBRL(indicators.simulatedBalance)} />
        <StatCard
          label="Contas vencidas"
          value={indicators.overduePayableCount + indicators.overdueReceivableCount}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Nova conta a pagar
          </h2>
          <div className="mt-4">
            <FinanceForm type="payable" suppliers={suppliers} customers={customers} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Nova conta a receber
          </h2>
          <div className="mt-4">
            <FinanceForm type="receivable" suppliers={suppliers} customers={customers} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-muted">Contas a pagar</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <tbody>
                {payable.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-center text-muted">Nenhuma conta.</td>
                  </tr>
                )}
                {payable.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{a.description}</p>
                      <p className="text-xs text-muted">
                        {a.supplier_name ?? "Sem fornecedor"} · Vence em{" "}
                        {new Date(a.due_date).toLocaleDateString("pt-BR")}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-foreground">
                      {formatBRL(Number(a.amount))}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted">Contas a receber</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <tbody>
                {receivable.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-center text-muted">Nenhuma conta.</td>
                  </tr>
                )}
                {receivable.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{a.description}</p>
                      <p className="text-xs text-muted">
                        {a.customer_name ?? "Sem cliente"} · Vence em{" "}
                        {new Date(a.due_date).toLocaleDateString("pt-BR")}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-foreground">
                      {formatBRL(Number(a.amount))}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
