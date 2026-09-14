import { query, queryOne } from "@/lib/db";
import type { Product, Category, Supplier, Customer } from "@/types";

export async function listProducts(): Promise<Product[]> {
  return query<Product>(
    `SELECT p.id, p.code, p.name, p.category_id, p.supplier_id, p.price,
            p.cost_price, p.stock, p.min_stock, p.active,
            c.name AS category_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.active
     ORDER BY p.name ASC`
  );
}

export async function findProducts(search: string): Promise<Product[]> {
  return query<Product>(
    `SELECT id, code, name, category_id, supplier_id, price, cost_price, stock, min_stock, active
     FROM products
     WHERE active AND (name ILIKE $1 OR code ILIKE $1)
     ORDER BY name ASC
     LIMIT 15`,
    [`%${search}%`]
  );
}

export async function listCategories(): Promise<Category[]> {
  return query<Category>(`SELECT id, name FROM categories ORDER BY name ASC`);
}

export async function listSuppliers(): Promise<Supplier[]> {
  return query<Supplier>(`SELECT id, name, contact FROM suppliers ORDER BY name ASC`);
}

export async function listCustomers(): Promise<Customer[]> {
  return query<Customer>(`SELECT id, name, contact FROM customers ORDER BY name ASC`);
}

export async function createCategory(name: string): Promise<Category> {
  const category = await queryOne<Category>(
    `INSERT INTO categories (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
    [name]
  );
  if (!category) throw new Error("Falha ao criar categoria.");
  return category;
}

export async function createSupplier(name: string, contact?: string): Promise<Supplier> {
  const supplier = await queryOne<Supplier>(
    `INSERT INTO suppliers (name, contact) VALUES ($1, $2) RETURNING id, name, contact`,
    [name, contact ?? null]
  );
  if (!supplier) throw new Error("Falha ao criar fornecedor.");
  return supplier;
}

export async function createCustomer(name: string, contact?: string): Promise<Customer> {
  const customer = await queryOne<Customer>(
    `INSERT INTO customers (name, contact) VALUES ($1, $2) RETURNING id, name, contact`,
    [name, contact ?? null]
  );
  if (!customer) throw new Error("Falha ao criar cliente.");
  return customer;
}

export interface CreateProductInput {
  code?: string;
  name: string;
  categoryId?: string;
  supplierId?: string;
  price: number;
  costPrice?: number;
  stock?: number;
  minStock?: number;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const product = await queryOne<Product>(
    `INSERT INTO products (code, name, category_id, supplier_id, price, cost_price, stock, min_stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, code, name, category_id, supplier_id, price, cost_price, stock, min_stock, active`,
    [
      input.code ?? null,
      input.name,
      input.categoryId ?? null,
      input.supplierId ?? null,
      input.price,
      input.costPrice ?? null,
      input.stock ?? 0,
      input.minStock ?? 5,
    ]
  );
  if (!product) throw new Error("Falha ao criar produto.");
  return product;
}

export async function adjustStock(
  productId: string,
  type: "entrada" | "saida" | "ajuste",
  quantity: number,
  userId: string,
  reason?: string
) {
  const delta = type === "saida" ? -Math.abs(quantity) : Math.abs(quantity);
  await queryOne(
    `UPDATE products SET stock = GREATEST(stock + $1::int, 0) WHERE id = $2::uuid RETURNING id`,
    [delta, productId]
  );
  await queryOne(
    `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [productId, type, Math.abs(quantity), reason ?? null, userId]
  );
}
