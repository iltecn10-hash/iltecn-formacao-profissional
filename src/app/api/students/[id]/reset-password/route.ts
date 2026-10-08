import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { resetStudentPassword } from "@/modules/students/queries";

const bodySchema = z.object({
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres.").max(72).optional(),
});

// Sem caracteres ambíguos (0/O, 1/l/I) — a senha provisória é ditada ou digitada por crianças.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function generateTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "admin" && session.role !== "teacher" && session.role !== "coordinator")
  ) {
    return NextResponse.json(
      { error: "Você não tem permissão para redefinir senhas." },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Aluno inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const password = parsed.data.password ?? generateTemporaryPassword();
  const student = await resetStudentPassword(
    { userId: session.userId, role: session.role },
    id,
    password
  );
  if (!student) {
    return NextResponse.json(
      { error: "Aluno não encontrado ou fora do seu acesso." },
      { status: 404 }
    );
  }

  // A senha só aparece nesta resposta; no banco fica apenas o hash.
  return NextResponse.json({ student, temporaryPassword: password });
}
