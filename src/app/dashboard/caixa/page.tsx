import { CaixaApp } from "@/components/caixa-app";

export default function CaixaPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Caixa — Supermercado Bom Preço
      </h1>
      <p className="mt-1 text-muted">
        Simulação de PDV. Nenhum pagamento é real.
      </p>
      <CaixaApp />
    </div>
  );
}
