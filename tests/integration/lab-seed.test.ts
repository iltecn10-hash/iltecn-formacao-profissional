import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../setup/testDb";
import { seedLabProgram } from "@/modules/lab/seed";
import { LAB_ACHIEVEMENTS } from "@/lib/lab/content/achievements";
import { LAB_LESSONS } from "@/lib/lab/content";

let testDb: ReturnType<typeof createTestDb>;
const client = () => ({
  query: async (text: string, params?: unknown[]) => ({ rows: await testDb.query(text, params) }),
});

describe("seedLabProgram", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("cria trilha infantil, 6 módulos, 30 aulas, atividades e conquistas", async () => {
    const summary = await seedLabProgram(client());
    expect(summary.trackCreated).toBe(true);
    expect(summary.modulesCreated).toBe(6);
    expect(summary.lessonsCreated).toBe(30);
    expect(summary.achievementsCreated).toBe(LAB_ACHIEVEMENTS.length);

    const track = await testDb.queryOne<{ audience: string }>(
      `SELECT audience FROM tracks WHERE slug = 'primeiros-passos-no-computador'`
    );
    expect(track?.audience).toBe("kids");
    const acts = await testDb.query(`SELECT id FROM mission_activities`);
    expect(acts.length).toBe(LAB_LESSONS.reduce((s, l) => s + l.activities.length, 0));
  });

  it("é idempotente: rodar duas vezes não duplica nada", async () => {
    await seedLabProgram(client());
    const count = async (t: string) => Number((await testDb.queryOne<{ n: string }>(`SELECT COUNT(*) AS n FROM ${t}`))!.n);
    const before = {
      tracks: await count("tracks"),
      modules: await count("modules"),
      missions: await count("missions"),
      tasks: await count("mission_tasks"),
      acts: await count("mission_activities"),
      ach: await count("achievements"),
    };
    const second = await seedLabProgram(client());
    expect(second.trackCreated).toBe(false);
    expect(second.lessonsCreated).toBe(0);
    expect(second.activitiesCreated).toBe(0);
    expect(second.achievementsCreated).toBe(0);
    expect({
      tracks: await count("tracks"),
      modules: await count("modules"),
      missions: await count("missions"),
      tasks: await count("mission_tasks"),
      acts: await count("mission_activities"),
      ach: await count("achievements"),
    }).toEqual(before);
  });

  it("não sobrescreve edição do administrador sem overwrite", async () => {
    await seedLabProgram(client());
    await testDb.query(`UPDATE mission_activities SET xp = 999 WHERE code = 'lab-a01-1'`);
    await seedLabProgram(client());
    expect((await testDb.queryOne<{ xp: number }>(`SELECT xp FROM mission_activities WHERE code = 'lab-a01-1'`))?.xp).toBe(999);
    await seedLabProgram(client(), { overwrite: true });
    expect((await testDb.queryOne<{ xp: number }>(`SELECT xp FROM mission_activities WHERE code = 'lab-a01-1'`))?.xp).not.toBe(999);
  });
});
