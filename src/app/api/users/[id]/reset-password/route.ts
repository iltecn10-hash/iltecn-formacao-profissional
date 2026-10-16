import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateTemporaryPassword } from "@/lib/password-policy";
import { resetUserPassword } from "@/modules/users/queries";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role === "student") {
    return NextResponse.json({ error: "Você não tem permissão para redefinir senhas." }, { status: 403 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  }
  const password = generateTemporaryPassword();
  const user = await resetUserPassword({ userId: session.userId, role: session.role }, id, password);
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado ou fora do seu acesso." }, { status: 404 });
  }
  // A senha só aparece nesta resposta; no banco fica apenas o hash.
  return NextResponse.json({ user, temporaryPassword: password });
}
