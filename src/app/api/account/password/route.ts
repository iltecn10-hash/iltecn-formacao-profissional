import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { validateNewPassword } from "@/lib/password-policy";
import { changeOwnPassword } from "@/modules/users/queries";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual.").max(200),
  newPassword: z.string().min(1, "Informe a nova senha.").max(200),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }
  const { currentPassword, newPassword } = parsed.data;
  const policyError = validateNewPassword(session.role, newPassword);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  const result = await changeOwnPassword(session.userId, currentPassword, newPassword);
  if (result === "wrong_current") {
    return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 400 });
  }
  if (result === "same_password") {
    return NextResponse.json({ error: "A nova senha precisa ser diferente da atual." }, { status: 400 });
  }
  if (result !== "ok") {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
