import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: {
    connect: (...args: unknown[]) =>
      (testDb.pool.connect as (...a: unknown[]) => unknown)(...args),
  },
  query: (...args: [string, unknown[]?]) => testDb.query(...args),
  queryOne: (...args: [string, unknown[]?]) => testDb.queryOne(...args),
}));

const { finalizeSale } = await import("@/modules/supermarket/sales");

async function seedStore() {
  const operator = await testDb.queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'student') RETURNING id`,
    ["operador@teste.com", "hash", "Operador Teste"]
  );
  const product = await testDb.queryOne<{ id: string }>(
    `INSERT INTO products (code, name, price, stock) VALUES ('001', 'Arroz 5kg', 24.90, 10) RETURNING id`
  );
  const register = await testDb.queryOne<{ id: string }>(
    `INSERT INTO cash_registers (opened_by, opening_amount) VALUES ($1, 50) RETURNING id`,
    [operator!.id]
  );
  return { operatorId: operator!.id, productId: product!.id, registerId: register!.id };
}

describe("finalizeSale", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("registra a venda, debita o estoque e calcula o total com desconto", async () => {
    const { operatorId, productId, registerId } = await seedStore();

    const sale = await finalizeSale({
      cashRegisterId: registerId,
      operatorId,
      items: [{ productId, name: "Arroz 5kg", unitPrice: 24.9, quantity: 2 }],
      discount: 5,
      paymentMethod: "dinheiro",
    });

    expect(Number(sale.total)).toBeCloseTo(24.9 * 2 - 5);

    const product = await testDb.queryOne<{ stock: number }>(
      `SELECT stock FROM products WHERE id = $1`,
      [productId]
    );
    expect(product?.stock).toBe(8);

    const movements = await testDb.query(
      `SELECT * FROM inventory_movements WHERE product_id = $1`,
      [productId]
    );
    expect(movements).toHaveLength(1);
  });

  it("rejeita a venda quando o estoque é insuficiente e não altera nada", async () => {
    const { operatorId, productId, registerId } = await seedStore();

    await expect(
      finalizeSale({
        cashRegisterId: registerId,
        operatorId,
        items: [{ productId, name: "Arroz 5kg", unitPrice: 24.9, quantity: 999 }],
        discount: 0,
        paymentMethod: "dinheiro",
      })
    ).rejects.toThrow(/estoque insuficiente/i);

    const product = await testDb.queryOne<{ stock: number }>(
      `SELECT stock FROM products WHERE id = $1`,
      [productId]
    );
    expect(product?.stock).toBe(10); // inalterado

    const sales = await testDb.query(`SELECT * FROM sales`);
    expect(sales).toHaveLength(0);
  });
});
