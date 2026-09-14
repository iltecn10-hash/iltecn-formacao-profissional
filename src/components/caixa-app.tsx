"use client";

import { useEffect, useState } from "react";
import type { CashRegister, Product, PaymentMethod, Sale } from "@/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

type CartItem = { productId: string; name: string; unitPrice: number; quantity: number };

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CaixaApp() {
  const [register, setRegister] = useState<CashRegister | null | undefined>(undefined);
  const [sales, setSales] = useState<Sale[]>([]);
  const [openingAmount, setOpeningAmount] = useState(50);

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRegister() {
    const res = await fetch("/api/supermarket/cash-register");
    const data = await res.json();
    setRegister(data.register ?? null);
    setSales(data.sales ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/supermarket/cash-register")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setRegister(data.register ?? null);
          setSales(data.sales ?? []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (searchTerm.trim().length === 0) {
        if (!cancelled) setResults([]);
        return;
      }
      fetch(`/api/supermarket/products/search?q=${encodeURIComponent(searchTerm)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setResults(data.products ?? []);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchTerm]);

  async function handleOpenRegister() {
    setError(null);
    const res = await fetch("/api/supermarket/cash-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingAmount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    loadRegister();
  }

  async function handleCloseRegister() {
    setError(null);
    const res = await fetch("/api/supermarket/cash-register/close", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCart([]);
    loadRegister();
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.price),
          quantity: 1,
        },
      ];
    });
    setSearchTerm("");
    setResults([]);
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const total = Math.max(subtotal - discount, 0);

  async function handleFinalize() {
    setError(null);
    setSuccess(null);
    if (cart.length === 0) {
      setError("Adicione ao menos um produto ao carrinho.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/supermarket/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart, discount, paymentMethod }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }
    setSuccess(`Venda finalizada: ${formatBRL(total)}`);
    setCart([]);
    setDiscount(0);
    setLoading(false);
    loadRegister();
  }

  if (register === undefined) {
    return <p className="mt-6 text-sm text-muted">Carregando caixa…</p>;
  }

  if (register === null) {
    return (
      <div className="mt-6 max-w-sm rounded-lg border border-border bg-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Abrir caixa
        </h2>
        <p className="mt-1 text-sm text-muted">
          Informe o valor inicial em dinheiro para começar o turno.
        </p>
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Valor de abertura
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={openingAmount}
            onChange={(e) => setOpeningAmount(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button
          onClick={handleOpenRegister}
          className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          Abrir caixa
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="rounded-lg border border-border bg-surface p-6">
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Buscar produto (nome ou código)
          </label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ex: arroz ou 7001"
            className={inputClass}
          />
          {results.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-border rounded-md border border-border">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => addToCart(p)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition hover:bg-background"
                  >
                    <span>
                      {p.name}{" "}
                      <span className="text-muted">({p.code ?? "sem código"})</span>
                    </span>
                    <span className="font-medium">{formatBRL(Number(p.price))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background">
              <tr>
                <th className="px-5 py-3 font-medium text-muted">Produto</th>
                <th className="px-5 py-3 font-medium text-muted">Qtd.</th>
                <th className="px-5 py-3 font-medium text-muted">Unitário</th>
                <th className="px-5 py-3 font-medium text-muted">Subtotal</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Carrinho vazio. Busque um produto acima.
                  </td>
                </tr>
              )}
              {cart.map((item) => (
                <tr key={item.productId} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">{item.name}</td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.productId, Number(e.target.value))
                      }
                      className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-5 py-3 text-muted">{formatBRL(item.unitPrice)}</td>
                  <td className="px-5 py-3 font-medium text-foreground">
                    {formatBRL(item.unitPrice * item.quantity)}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-sm text-danger hover:underline"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sales.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted">Vendas deste turno</h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {sales.map((s) => (
                <li key={s.id} className="flex justify-between text-foreground">
                  <span>{new Date(s.created_at).toLocaleTimeString("pt-BR")}</span>
                  <span>{formatBRL(Number(s.total))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Fechamento</h2>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Desconto (R$)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className={inputClass}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Forma de pagamento
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className={inputClass}
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="debito">Cartão de débito</option>
            <option value="credito">Cartão de crédito</option>
          </select>
        </div>

        <div className="mt-5 flex flex-col gap-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Desconto</span>
            <span>-{formatBRL(discount)}</span>
          </div>
          <div className="flex justify-between font-heading text-lg font-bold text-foreground">
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 rounded-md bg-primary-light px-3 py-2 text-sm text-primary-dark">
            {success}
          </p>
        )}

        <button
          onClick={handleFinalize}
          disabled={loading}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? "Finalizando…" : "Finalizar venda"}
        </button>

        <button
          onClick={handleCloseRegister}
          className="mt-3 w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background"
        >
          Fechar caixa
        </button>
      </div>
    </div>
  );
}
