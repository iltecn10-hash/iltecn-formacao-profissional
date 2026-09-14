import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getOpenRegister, openRegister, listSalesByRegister } from "@/modules/supermarket/sales";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const register = await getOpenRegister(session.userId);
  const sales = register ? await listSalesByRegister(register.id) : [];
  return NextResponse.json({ register, sales });
}

const schema = z.object({ openingAmount: z.number().min(0) });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const existing = await getOpenRegister(session.userId);
  if (existing) {
    return NextResponse.json(
      { error: "Você já tem um caixa aberto." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valor de abertura inválido." }, { status: 400 });
  }

  const register = await openRegister(session.userId, parsed.data.openingAmount);
  return NextResponse.json({ register }, { status: 201 });
}
