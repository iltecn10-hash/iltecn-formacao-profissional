import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listCustomers, createCustomer } from "@/modules/supermarket/products";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const customers = await listCustomers();
  return NextResponse.json({ customers });
}

const schema = z.object({ name: z.string().min(2), contact: z.string().optional() });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const customer = await createCustomer(parsed.data.name, parsed.data.contact);
  return NextResponse.json({ customer }, { status: 201 });
}
