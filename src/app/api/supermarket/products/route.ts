import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listProducts, createProduct } from "@/modules/supermarket/products";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const products = await listProducts();
  return NextResponse.json({ products });
}

const createSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2, "Nome muito curto."),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  price: z.number().min(0),
  costPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json(
      { error: "Você não tem permissão para cadastrar produtos." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  try {
    const product = await createProduct(parsed.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Verifique os dados e tente novamente." },
      { status: 400 }
    );
  }
}
