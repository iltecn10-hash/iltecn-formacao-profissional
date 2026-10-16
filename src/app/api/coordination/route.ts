import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { validateNewPassword } from "@/lib/password-policy";
import { createCoordinationMember, listCoordinationMembers } from "@/modules/coordination/queries";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  return NextResponse.json({ members: await listCoordinationMembers() });
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto."),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string(),
  schoolId: z.string().uuid("Escola inválida."),
  position: z.enum(["coordenador", "diretor"], { message: "Cargo inválido." }),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem cadastrar coordenadores e diretores." },
      { status: 403 }
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const problem = validateNewPassword("coordinator", parsed.data.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const member = await createCoordinationMember(parsed.data);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "Já existe um usuário com este e-mail."
        : "Não foi possível concluir esta operação. Verifique os dados e tente novamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
