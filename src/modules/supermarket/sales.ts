import { pool, query, queryOne } from "@/lib/db";
import type { CashRegister, Sale, SaleItemInput, PaymentMethod } from "@/types";

export async function getOpenRegister(userId: string): Promise<CashRegister | null> {
  return queryOne<CashRegister>(
    `SELECT * FROM cash_registers WHERE opened_by = $1 AND status = 'aberto' ORDER BY opened_at DESC LIMIT 1`,
    [userId]
  );
}

export async function openRegister(
  userId: string,
  openingAmount: number
): Promise<CashRegister> {
  const register = await queryOne<CashRegister>(
    `INSERT INTO cash_registers (opened_by, opening_amount) VALUES ($1, $2) RETURNING *`,
    [userId, openingAmount]
  );
  if (!register) throw new Error("Falha ao abrir o caixa.");
  return register;
}

export async function closeRegister(registerId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const salesTotal = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(total), 0) AS total FROM sales
       WHERE cash_register_id = $1 AND status = 'concluida'`,
      [registerId]
    );
    const register = await client.query<{ opening_amount: string }>(
      `SELECT opening_amount FROM cash_registers WHERE id = $1`,
      [registerId]
    );
    const closingAmount =
      Number(register.rows[0]?.opening_amount ?? 0) + Number(salesTotal.rows[0]?.total ?? 0);

    await client.query(
      `UPDATE cash_registers SET status = 'fechado', closed_at = now(), closing_amount = $1 WHERE id = $2`,
      [closingAmount, registerId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listSalesByRegister(registerId: string): Promise<Sale[]> {
  return query<Sale>(
    `SELECT * FROM sales WHERE cash_register_id = $1 ORDER BY created_at DESC`,
    [registerId]
  );
}

export interface FinalizeSaleInput {
  cashRegisterId: string;
  operatorId: string;
  customerId?: string;
  items: SaleItemInput[];
  discount: number;
  paymentMethod: PaymentMethod;
}

/**
 * Finaliza uma venda: valida estoque, cria a venda + itens, debita o estoque
 * e registra o movimento de saída — tudo em uma única transação.
 */
export async function finalizeSale(input: FinalizeSaleInput): Promise<Sale> {
  if (input.items.length === 0) {
    throw new Error("Adicione ao menos um produto à venda.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Trava as linhas de produto para evitar vender acima do estoque em concorrência
    for (const item of input.items) {
      const productResult = await client.query<{ stock: number; price: string }>(
        `SELECT stock, price FROM products WHERE id = $1 FOR UPDATE`,
        [item.productId]
      );
      const product = productResult.rows[0];
      if (!product) throw new Error(`Produto não encontrado: ${item.name}`);
      if (product.stock < item.quantity) {
        throw new Error(
          `Estoque insuficiente para "${item.name}" (disponível: ${product.stock}).`
        );
      }
    }

    const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const total = Math.max(subtotal - input.discount, 0);

    const saleResult = await client.query<Sale>(
      `INSERT INTO sales (cash_register_id, operator_id, customer_id, subtotal, discount, total, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.cashRegisterId,
        input.operatorId,
        input.customerId ?? null,
        subtotal,
        input.discount,
        total,
        input.paymentMethod,
      ]
    );
    const sale = saleResult.rows[0];

    for (const item of input.items) {
      const itemSubtotal = item.unitPrice * item.quantity;
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sale.id, item.productId, item.name, item.quantity, item.unitPrice, itemSubtotal]
      );
      await client.query(
        `UPDATE products SET stock = stock - $1::int WHERE id = $2::uuid`,
        [item.quantity, item.productId]
      );
      await client.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, 'saida', $2, 'Venda no caixa', $3)`,
        [item.productId, item.quantity, input.operatorId]
      );
    }

    await client.query("COMMIT");
    return sale;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
