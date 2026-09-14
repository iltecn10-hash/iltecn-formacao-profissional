import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listMissionsByModule, createMission } from "@/modules/missions/queries";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const moduleId = request.nextUrl.searchParams.get("moduleId");
  if (!moduleId) {
    return NextResponse.json({ error: "moduleId é obrigatório." }, { status: 400 });
  }
  const missions = await listMissionsByModule(moduleId);
  return NextResponse.json({ missions });
}

const createSchema = z.object({
  moduleId: z.string().uuid("Módulo inválido."),
  title: z.string().min(2, "Título muito curto."),
  context: z.string().optional(),
  objective: z.string().optional(),
  level: z.number().int().min(1).max(5).optional(),
  pointsValue: z.number().int().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  resourceUrl: z.string().url("Link inválido.").optional().or(z.literal("")),
  tasks: z.array(z.string()).default([]),
  competencyIds: z.array(z.string().uuid()).default([]),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem criar missões." },
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

  const mission = await createMission({
    ...parsed.data,
    resourceUrl: parsed.data.resourceUrl || undefined,
  });
  return NextResponse.json({ mission }, { status: 201 });
}
