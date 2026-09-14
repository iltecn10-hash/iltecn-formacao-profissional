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

const { listMissionsByModule } = await import("@/modules/missions/queries");

/**
 * Fase 9.4: a própria missão declara seu `work_config` (workType/templateKey),
 * substituindo a escolha manual de missão/modelo que existia nos formulários
 * "Novo documento"/"Nova planilha" da 9.2/9.3.
 */
describe("missions.work_config (Fase 9.4)", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  async function seedModuleWithMissions() {
    const track = await testDb.queryOne<{ id: string }>(
      `INSERT INTO tracks (name, slug) VALUES ('Documentos', 'documentos') RETURNING id`
    );
    const mod = await testDb.queryOne<{ id: string }>(
      `INSERT INTO modules (track_id, name) VALUES ($1, 'Editor de Texto') RETURNING id`,
      [track!.id]
    );
    const withConfig = await testDb.queryOne<{ id: string }>(
      `INSERT INTO missions (module_id, title, work_config)
       VALUES ($1, 'Memorando: Mudança no Horário de Almoço', $2::jsonb)
       RETURNING id`,
      [mod!.id, JSON.stringify({ workType: "DOCUMENT", templateKey: "memorando" })]
    );
    const withoutConfig = await testDb.queryOne<{ id: string }>(
      `INSERT INTO missions (module_id, title) VALUES ($1, 'Backup em Pendrive') RETURNING id`,
      [mod!.id]
    );
    return { moduleId: mod!.id, withConfigId: withConfig!.id, withoutConfigId: withoutConfig!.id };
  }

  it("listMissionsByModule devolve work_config como objeto, não como string", async () => {
    const { moduleId, withConfigId, withoutConfigId } = await seedModuleWithMissions();

    const missions = await listMissionsByModule(moduleId);
    const configured = missions.find((m) => m.id === withConfigId);
    const unconfigured = missions.find((m) => m.id === withoutConfigId);

    expect(configured?.work_config).toEqual({ workType: "DOCUMENT", templateKey: "memorando" });
    expect(unconfigured?.work_config).toBeNull();
  });

  // `getStudentProgress` usa uma subquery correlacionada (array_agg de competências)
  // combinada com LEFT JOIN que o pg-mem não consegue resolver (ver nota sobre
  // subqueries correlacionadas em CLAUDE.md) — funciona normalmente no Postgres
  // real, mas não é testável em memória. A cobertura de `work_config` fica com
  // `listMissionsByModule`, que usa a mesma coluna sem essa subquery.
});
