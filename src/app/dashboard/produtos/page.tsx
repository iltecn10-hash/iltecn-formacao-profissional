import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProducts, listCategories, listSuppliers } from "@/modules/supermarket/products";
import { ProductForm } from "@/components/product-form";

export default async function ProdutosPage() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    redirect("/dashboard");
  }

  const [products, categories, suppliers] = await Promise.all([
    listProducts(),
    listCategories(),
    listSuppliers(),
  ]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Estoque — Supermercado Bom Preço
      </h1>
      <p className="mt-1 text-muted">Catálogo e estoque fictícios para prática.</p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Cadastrar produto
        </h2>
        <div className="mt-4">
          <ProductForm categories={categories} suppliers={suppliers} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-5 py-3 font-medium text-muted">Código</th>
              <th className="px-5 py-3 font-medium text-muted">Produto</th>
              <th className="px-5 py-3 font-medium text-muted">Categoria</th>
              <th className="px-5 py-3 font-medium text-muted">Fornecedor</th>
              <th className="px-5 py-3 font-medium text-muted">Preço</th>
              <th className="px-5 py-3 font-medium text-muted">Estoque</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted">
                  Nenhum produto cadastrado ainda.
                </td>
              </tr>
            )}
            {products.map((p) => {
              const low = p.stock <= p.min_stock;
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-muted">{p.code ?? "—"}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-3 text-muted">{p.category_name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{p.supplier_name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">
                    {Number(p.price).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        low ? "bg-danger/10 text-danger" : "bg-primary-light text-primary-dark"
                      }`}
                    >
                      {p.stock} {low ? "· abaixo do mínimo" : ""}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
