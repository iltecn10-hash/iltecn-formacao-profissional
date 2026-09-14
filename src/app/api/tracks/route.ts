import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listTracks, createTrack } from "@/modules/tracks/queries";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const tracks = await listTracks();
  return NextResponse.json({ tracks });
}

const createSchema = z.object({
  name: z.string().min(2, "Nome muito curto."),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem criar trilhas." },
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

  const track = await createTrack(parsed.data);
  return NextResponse.json({ track }, { status: 201 });
}
