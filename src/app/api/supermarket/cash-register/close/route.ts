import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOpenRegister, closeRegister } from "@/modules/supermarket/sales";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const register = await getOpenRegister(session.userId);
  if (!register) {
    return NextResponse.json({ error: "Nenhum caixa aberto." }, { status: 400 });
  }

  await closeRegister(register.id);
  return NextResponse.json({ success: true });
}
