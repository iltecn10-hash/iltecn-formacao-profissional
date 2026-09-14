import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  listAccountsPayable,
  createAccountPayable,
} from "@/modules/supermarket/finance";

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const accounts = await listAccountsPayable();
  return NextResponse.json({ accounts });
}

const schema = z.object({
  supplierId: z.string().uuid().optional(),
  description: z.string().min(2),
  dueDate: z.string(),
  amount: z.number().min(0.01),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "teacher")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }
  const account = await createAccountPayable(parsed.data);
  return NextResponse.json({ account }, { status: 201 });
}
