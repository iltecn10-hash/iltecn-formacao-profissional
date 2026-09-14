import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listAllModules, createModule } from "@/modules/tracks/queries";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const modules = await listAllModules();
  return NextResponse.json({ modules });
}

const createSchema = z.object({
  trackId: z.string().uuid("Trilha inválida."),
  name: z.string().min(2, "Nome muito curto."),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem criar módulos." },
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

  const courseModule = await createModule(parsed.data);
  return NextResponse.json({ module: courseModule }, { status: 201 });
}
