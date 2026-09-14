import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getOpenRegister, finalizeSale } from "@/modules/supermarket/sales";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        name: z.string(),
        unitPrice: z.number().min(0),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, "Adicione ao menos um produto."),
  discount: z.number().min(0).default(0),
  paymentMethod: z.enum(["dinheiro", "pix", "debito", "credito"]),
  customerId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const register = await getOpenRegister(session.userId);
  if (!register) {
    return NextResponse.json(
      { error: "Abra o caixa antes de registrar uma venda." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  try {
    const sale = await finalizeSale({
      cashRegisterId: register.id,
      operatorId: session.userId,
      customerId: parsed.data.customerId,
      items: parsed.data.items,
      discount: parsed.data.discount,
      paymentMethod: parsed.data.paymentMethod,
    });
    return NextResponse.json({ sale }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Não foi possível concluir esta operação. Verifique os dados e tente novamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
