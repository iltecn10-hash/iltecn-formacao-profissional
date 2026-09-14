import { query, queryOne } from "@/lib/db";
import type { AccountPayable, AccountReceivable } from "@/types";

export async function listAccountsPayable(): Promise<AccountPayable[]> {
  return query<AccountPayable>(
    `SELECT ap.id, ap.supplier_id, ap.description, ap.due_date, ap.amount, ap.status,
            s.name AS supplier_name
     FROM accounts_payable ap
     LEFT JOIN suppliers s ON s.id = ap.supplier_id
     ORDER BY ap.due_date ASC`
  );
}

export async function listAccountsReceivable(): Promise<AccountReceivable[]> {
  return query<AccountReceivable>(
    `SELECT ar.id, ar.customer_id, ar.description, ar.due_date, ar.amount, ar.status,
            c.name AS customer_name
     FROM accounts_receivable ar
     LEFT JOIN customers c ON c.id = ar.customer_id
     ORDER BY ar.due_date ASC`
  );
}

export async function createAccountPayable(input: {
  supplierId?: string;
  description: string;
  dueDate: string;
  amount: number;
}): Promise<AccountPayable> {
  const account = await queryOne<AccountPayable>(
    `INSERT INTO accounts_payable (supplier_id, description, due_date, amount)
     VALUES ($1, $2, $3, $4) RETURNING id, supplier_id, description, due_date, amount, status`,
    [input.supplierId ?? null, input.description, input.dueDate, input.amount]
  );
  if (!account) throw new Error("Falha ao criar conta a pagar.");
  return account;
}

export async function createAccountReceivable(input: {
  customerId?: string;
  description: string;
  dueDate: string;
  amount: number;
}): Promise<AccountReceivable> {
  const account = await queryOne<AccountReceivable>(
    `INSERT INTO accounts_receivable (customer_id, description, due_date, amount)
     VALUES ($1, $2, $3, $4) RETURNING id, customer_id, description, due_date, amount, status`,
    [input.customerId ?? null, input.description, input.dueDate, input.amount]
  );
  if (!account) throw new Error("Falha ao criar conta a receber.");
  return account;
}

export async function markAccountPayablePaid(id: string) {
  await queryOne(
    `UPDATE accounts_payable SET status = 'pago' WHERE id = $1 RETURNING id`,
    [id]
  );
}

export async function markAccountReceivableReceived(id: string) {
  await queryOne(
    `UPDATE accounts_receivable SET status = 'recebido' WHERE id = $1 RETURNING id`,
    [id]
  );
}

export async function getFinancialIndicators() {
  const [paid, pending, received, receivablePending, overduePayable, overdueReceivable] =
    await Promise.all([
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM accounts_payable WHERE status = 'pago'`
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM accounts_payable WHERE status = 'pendente'`
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM accounts_receivable WHERE status = 'recebido'`
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM accounts_receivable WHERE status = 'pendente'`
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM accounts_payable WHERE status = 'pendente' AND due_date < CURRENT_DATE`
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM accounts_receivable WHERE status = 'pendente' AND due_date < CURRENT_DATE`
      ),
    ]);

  const totalPaid = Number(paid?.total ?? 0);
  const totalReceived = Number(received?.total ?? 0);

  return {
    totalPaid,
    totalPending: Number(pending?.total ?? 0),
    totalReceived,
    totalReceivablePending: Number(receivablePending?.total ?? 0),
    overduePayableCount: Number(overduePayable?.count ?? 0),
    overdueReceivableCount: Number(overdueReceivable?.count ?? 0),
    simulatedBalance: totalReceived - totalPaid,
  };
}
