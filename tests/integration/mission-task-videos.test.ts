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

const {
  listMissionTasksWithVideo,
  upsertMissionTaskVideo,
  deleteMissionTaskVideo,
  getMissionTaskById,
} = await import("@/modules/missions/queries");

/**
 * Fase 10.1: vídeos didáticos por etapa (aditivo "VÍDEOS DIDÁTICOS NAS
 * MISSÕES"). `mission_tasks` já existia desde o início do projeto, mas esta
 * é a primeira vez que a etapa em si é lida pela aplicação — antes só era
 * gravada na criação da missão e nunca exibida.
 */
describe("mission_task_videos (Fase 10.1)", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  async function seedMissionWithTasks() {
    const track = await testDb.queryOne<{ id: string }>(
      `INSERT INTO tracks (name, slug) VALUES ('Excel', 'excel') RETURNING id`
    );
    const mod = await testDb.queryOne<{ id: string }>(
      `INSERT INTO modules (track_id, name) VALUES ($1, 'Planilhas') RETURNING id`,
      [track!.id]
    );
    const mission = await testDb.queryOne<{ id: string }>(
      `INSERT INTO missions (module_id, title) VALUES ($1, 'Relatório de Vendas do Mês') RETURNING id`,
      [mod!.id]
    );
    const task1 = await testDb.queryOne<{ id: string }>(
      `INSERT INTO mission_tasks (mission_id, description, sort_order) VALUES ($1, 'Organizar os dados', 1) RETURNING id`,
      [mission!.id]
    );
    const task2 = await testDb.queryOne<{ id: string }>(
      `INSERT INTO mission_tasks (mission_id, description, sort_order) VALUES ($1, 'Calcular o total', 2) RETURNING id`,
      [mission!.id]
    );
    return { missionId: mission!.id, task1Id: task1!.id, task2Id: task2!.id };
  }

  it("lista as etapas de uma missão com video: null quando nenhuma tem vídeo", async () => {
    const { missionId, task1Id, task2Id } = await seedMissionWithTasks();

    const tasks = await listMissionTasksWithVideo(missionId);

    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.id)).toEqual([task1Id, task2Id]); // ordem por sort_order
    expect(tasks.every((t) => t.video === null)).toBe(true);
  });

  it("upsertMissionTaskVideo associa um vídeo a uma etapa específica, sem afetar as outras", async () => {
    const { missionId, task1Id, task2Id } = await seedMissionWithTasks();

    await upsertMissionTaskVideo(task1Id, {
      title: "Como organizar os dados",
      videoUrl: "https://youtube.com/watch?v=abc123",
      durationSeconds: 135,
    });

    const tasks = await listMissionTasksWithVideo(missionId);
    const withVideo = tasks.find((t) => t.id === task1Id);
    const withoutVideo = tasks.find((t) => t.id === task2Id);

    expect(withVideo?.video).toMatchObject({
      title: "Como organizar os dados",
      video_url: "https://youtube.com/watch?v=abc123",
      duration_seconds: 135,
      provider: "YOUTUBE",
      video_type: "DEMONSTRATIVO",
      active: true,
    });
    expect(withoutVideo?.video).toBeNull();
  });

  it("upsertMissionTaskVideo chamado de novo na mesma etapa substitui o vídeo em vez de duplicar", async () => {
    const { missionId, task1Id } = await seedMissionWithTasks();

    await upsertMissionTaskVideo(task1Id, {
      title: "Primeira versão",
      videoUrl: "https://youtube.com/watch?v=old",
    });
    await upsertMissionTaskVideo(task1Id, {
      title: "Vídeo trocado",
      videoUrl: "https://youtube.com/watch?v=new",
      videoType: "EXEMPLO",
    });

    const tasks = await listMissionTasksWithVideo(missionId);
    const task = tasks.find((t) => t.id === task1Id);

    expect(task?.video?.title).toBe("Vídeo trocado");
    expect(task?.video?.video_url).toBe("https://youtube.com/watch?v=new");
    expect(task?.video?.video_type).toBe("EXEMPLO");
  });

  it("deleteMissionTaskVideo remove o vídeo, voltando a etapa para video: null", async () => {
    const { missionId, task1Id } = await seedMissionWithTasks();
    await upsertMissionTaskVideo(task1Id, {
      title: "Vídeo temporário",
      videoUrl: "https://youtube.com/watch?v=temp",
    });

    await deleteMissionTaskVideo(task1Id);

    const tasks = await listMissionTasksWithVideo(missionId);
    expect(tasks.find((t) => t.id === task1Id)?.video).toBeNull();
  });

  it("getMissionTaskById devolve null para uma etapa inexistente", async () => {
    const task = await getMissionTaskById("00000000-0000-0000-0000-000000000000");
    expect(task).toBeNull();
  });
});
