import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: {
    connect: (...args: unknown[]) =>
      (testDb.pool.connect as (...a: unknown[]) => unknown)(...args),
  },
  query: (...args: [string, unknown[]?]) => testDb.query(...args),
  queryOne: (...args: [string, unknown[]?]) => testDb.queryOne(...args),
}));

const { getMissionVideo, upsertMissionVideo, deleteMissionVideo, getMissionById } = await import(
  "@/modules/missions/queries"
);

/**
 * Fase 10.5: vídeo explicativo da missão como um todo — diferente do vídeo
 * por etapa (Fase 10.1), aqui é uma relação 1:1 com a missão inteira
 * (`mission_videos.mission_id` é `UNIQUE`).
 */
describe("mission_videos (Fase 10.5)", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  async function seedMission() {
    const track = await testDb.queryOne<{ id: string }>(
      `INSERT INTO tracks (name, slug) VALUES ('Documentos', 'documentos') RETURNING id`
    );
    const mod = await testDb.queryOne<{ id: string }>(
      `INSERT INTO modules (track_id, name) VALUES ($1, 'Editor de Texto') RETURNING id`,
      [track!.id]
    );
    const mission = await testDb.queryOne<{ id: string }>(
      `INSERT INTO missions (module_id, title) VALUES ($1, 'Requerimento de Férias') RETURNING id`,
      [mod!.id]
    );
    return { missionId: mission!.id };
  }

  it("getMissionVideo devolve null quando a missão ainda não tem vídeo", async () => {
    const { missionId } = await seedMission();
    expect(await getMissionVideo(missionId)).toBeNull();
  });

  it("upsertMissionVideo cria o vídeo explicativo da missão", async () => {
    const { missionId } = await seedMission();

    await upsertMissionVideo(missionId, {
      title: "Como preencher o requerimento de férias",
      videoUrl: "/videos/requerimento-ferias/explicativo.mp4",
      provider: "INTERNAL",
      videoType: "EXPLICATIVO",
      durationSeconds: 40,
    });

    const video = await getMissionVideo(missionId);
    expect(video).toMatchObject({
      title: "Como preencher o requerimento de férias",
      video_url: "/videos/requerimento-ferias/explicativo.mp4",
      provider: "INTERNAL",
      video_type: "EXPLICATIVO",
      duration_seconds: 40,
      active: true,
    });
  });

  it("upsertMissionVideo chamado de novo substitui o vídeo em vez de duplicar", async () => {
    const { missionId } = await seedMission();

    await upsertMissionVideo(missionId, {
      title: "Primeira versão",
      videoUrl: "/videos/x/old.mp4",
      provider: "INTERNAL",
    });
    await upsertMissionVideo(missionId, {
      title: "Vídeo trocado",
      videoUrl: "/videos/x/new.mp4",
      provider: "INTERNAL",
      videoType: "ORIENTACAO",
    });

    const video = await getMissionVideo(missionId);
    expect(video?.title).toBe("Vídeo trocado");
    expect(video?.video_url).toBe("/videos/x/new.mp4");
    expect(video?.video_type).toBe("ORIENTACAO");
  });

  it("deleteMissionVideo remove o vídeo, voltando a missão para video: null", async () => {
    const { missionId } = await seedMission();
    await upsertMissionVideo(missionId, {
      title: "Temporário",
      videoUrl: "/videos/x/temp.mp4",
      provider: "INTERNAL",
    });

    await deleteMissionVideo(missionId);

    expect(await getMissionVideo(missionId)).toBeNull();
  });

  it("getMissionById devolve a missão, e null para um id inexistente", async () => {
    const { missionId } = await seedMission();
    const mission = await getMissionById(missionId);
    expect(mission?.title).toBe("Requerimento de Férias");
    expect(await getMissionById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
