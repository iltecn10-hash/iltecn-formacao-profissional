import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listSuppliers, createSupplier } from "@/modules/supermarket/products";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const suppliers = await listSuppliers();
  return NextResponse.json({ suppliers });
}

const schema = z.object({ name: z.string().min(2), contact: z.string().optional() });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const supplier = await createSupplier(parsed.data.name, parsed.data.contact);
  return NextResponse.json({ supplier }, { status: 201 });
}
