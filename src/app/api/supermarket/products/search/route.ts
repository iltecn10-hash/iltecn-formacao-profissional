import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findProducts } from "@/modules/supermarket/products";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ products: [] });
  }
  const products = await findProducts(q);
  return NextResponse.json({ products });
}
