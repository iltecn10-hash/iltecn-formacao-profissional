import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  deleteMissionVideo,
  getMissionById,
  upsertMissionVideo,
} from "@/modules/missions/queries";
import type { SessionPayload } from "@/types";

const STAFF_ROLES = ["admin", "teacher", "coordinator"] as const;

/**
 * Mesma checagem do vídeo de etapa (Fase 10.1), só que aqui contra a missão
 * inteira: só equipe gerencia, e a missão precisa existir.
 */
async function authorizeStaffMission(missionId: string, session: SessionPayload | null) {
  if (!session || !STAFF_ROLES.includes(session.role as (typeof STAFF_ROLES)[number])) {
    return {
      error: "Apenas professores, coordenadores ou administradores podem gerenciar vídeos." as const,
      status: 403 as const,
    };
  }
  const mission = await getMissionById(missionId);
  if (!mission) {
    return { error: "Missão não encontrada." as const, status: 404 as const };
  }
  return { mission };
}

const upsertSchema = z.object({
  title: z.string().trim().min(2, "Título muito curto.").max(255),
  description: z.string().trim().max(2000).optional(),
  videoUrl: z.string().url("URL do vídeo inválida."),
  thumbnailUrl: z.string().url("URL da miniatura inválida.").optional().or(z.literal("")),
  durationSeconds: z.number().int().min(1).max(10800).optional(),
  provider: z.enum(["YOUTUBE", "VIMEO", "CLOUD_STORAGE", "INTERNAL"]).optional(),
  videoType: z.enum(["EXPLICATIVO", "DEMONSTRATIVO", "EXEMPLO", "ORIENTACAO"]).optional(),
  active: z.boolean().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  const auth = await authorizeStaffMission(id, session);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const json = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const video = await upsertMissionVideo(id, {
    ...parsed.data,
    thumbnailUrl: parsed.data.thumbnailUrl || undefined,
  });
  return NextResponse.json({ video });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  const auth = await authorizeStaffMission(id, session);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await deleteMissionVideo(id);
  return NextResponse.json({ ok: true });
}
