/* eslint-disable @typescript-eslint/no-explicit-any -- gabaritos JSON de teste */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../setup/testDb";
import { solve } from "../setup/labSolver";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  pool: { connect: (...a: unknown[]) => (testDb.pool.connect as (...x: unknown[]) => unknown)(...a) },
  query: (...a: [string, unknown[]?]) => testDb.query(...a),
  queryOne: (...a: [string, unknown[]?]) => testDb.queryOne(...a),
}));

const { seedGames } = await import("@/modules/games/seed");
const g = await import("@/modules/games/queries");
const admin = await import("@/modules/games/admin");
const { exploradorDigital } = await import("@/lib/games/content/explorador-digital");
const { allChallenges, findChallenge } = await import("@/lib/games/engine");

const db = () => ({ query: async (t: string, p?: unknown[]) => ({ rows: await testDb.query(t, p) }) });
async function mk(table: string, cols: string, vals: unknown[]) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(",");
  return (await testDb.queryOne<{ id: string }>(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals))!.id;
}
async function student(name: string, audience = "professional") {
  const school = (await testDb.queryOne<{ id: string }>(`SELECT id FROM schools LIMIT 1`))?.id ?? (await mk("schools", "name", ["Escola"]));
  const u = await mk("users", "email, password_hash, name, role", [`${name}@x.com`, "h", name, "student"]);
  return mk("students", "user_id, school_id, audience", [u, school, audience]);
}
const points = async (id: string) => Number((await testDb.queryOne<{ points: number }>(`SELECT points FROM students WHERE id=$1`, [id]))!.points);
const gameId = async (code = "desafio-explorador-digital") => (await testDb.queryOne<{ id: string }>(`SELECT id FROM games WHERE code=$1`, [code]))!.id;

/** Joga a partida inteira respondendo certo (ou errado em `wrongOn`). */
async function play(studentId: string, attemptId: string, opts: { wrongAlways?: boolean } = {}) {
  for (const phase of exploradorDigital.config.phases) {
    for (const ch of phase.challenges) {
      if (opts.wrongAlways) {
        for (let i = 0; i < ch.maxTries; i++) await g.submitChallenge(studentId, attemptId, ch.id, {});
      } else {
        const r = await g.submitChallenge(studentId, attemptId, ch.id, solve(ch.kind, ch.config));
        expect(r.correct, ch.id).toBe(true);
      }
    }
  }
}

describe("Central de Jogos — partidas", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await seedGames(db());
  });

  it("seed é idempotente e cria a medalha por público", async () => {
    const again = await seedGames(db());
    expect(again).toEqual({ gamesCreated: 0, gamesUpdated: 0, achievementsCreated: 0 });
    expect(Number((await testDb.queryOne<any>(`SELECT COUNT(*)::int AS n FROM games`))!.n)).toBe(1);
    expect(Number((await testDb.queryOne<any>(`SELECT COUNT(*)::int AS n FROM achievements WHERE criteria_type='game_completed'`))!.n)).toBe(2);
  });

  it("carrega o jogo para o aluno SEM gabarito e lista como disponível", async () => {
    const s = await student("ana");
    const list = await g.listGamesForStudent(s, db());
    expect(list).toHaveLength(1);
    expect(list[0].state).toBe("available");
    const open = await g.startAttempt(s, await gameId());
    expect(open.phases).toHaveLength(6);
    expect(JSON.stringify(open)).not.toContain('"answer"');
    expect(JSON.stringify(open)).not.toContain("explain");
    // Fases bloqueadas chegam sem desafios.
    expect(open.phases[0].locked).toBe(false);
    expect(open.phases[1].locked).toBe(true);
    expect(open.phases[1].challenges).toHaveLength(0);
    expect(open.phases[1].challengeCount).toBe(2 + 1);
  });

  it("público: jogo infantil não aparece para profissional e rascunho não aparece para ninguém", async () => {
    await testDb.query(`UPDATE games SET audience='kids'`);
    const pro = await student("pro");
    const kid = await student("kid", "kids");
    expect(await g.listGamesForStudent(pro, db())).toHaveLength(0);
    await expect(g.startAttempt(pro, await gameId())).rejects.toMatchObject({ code: "not_found" });
    expect(await g.listGamesForStudent(kid, db())).toHaveLength(1);
    await testDb.query(`UPDATE games SET status='draft'`);
    expect(await g.listGamesForStudent(kid, db())).toHaveLength(0);
    await expect(g.getGameDetail(kid, await gameId())).rejects.toMatchObject({ code: "not_found" });
  });

  it("iniciar duas vezes devolve a MESMA partida (retomar)", async () => {
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    const b = await g.startAttempt(s, await gameId());
    expect(b.id).toBe(a.id);
    expect(Number((await testDb.queryOne<any>(`SELECT COUNT(*)::int AS n FROM game_attempts`))!.n)).toBe(1);
  });

  it("fase bloqueada recusa resposta; fase aberta aceita e a nota vem do servidor", async () => {
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    await expect(g.submitChallenge(s, a.id, "frase", {})).rejects.toMatchObject({ code: "locked" });
    await expect(g.submitChallenge(s, a.id, "nao-existe", {})).rejects.toMatchObject({ code: "invalid" });
    const ch = findChallenge(exploradorDigital.config, "cerebro")!.challenge;
    const wrong = await g.submitChallenge(s, a.id, "cerebro", { selected: ["mouse"] });
    expect(wrong).toMatchObject({ correct: false, resolved: false, triesLeft: 2, explain: null });
    const right = await g.submitChallenge(s, a.id, "cerebro", solve(ch.kind, ch.config));
    expect(right).toMatchObject({ correct: true, resolved: true, points: 6 }); // 8 pts × 70% (2ª tentativa)
    expect(right.explain).toMatch(/cérebro/);
    await expect(g.submitChallenge(s, a.id, "cerebro", solve(ch.kind, ch.config))).rejects.toMatchObject({ code: "conflict" });
  });

  it("fase só libera com o mínimo; sem ele a partida trava e termina reprovada com orientação", async () => {
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    // Fase 1 (mínimo 0): resolve tudo; fase 2 (mínimo 50%): erra tudo.
    for (const ch of exploradorDigital.config.phases[0].challenges) await g.submitChallenge(s, a.id, ch.id, solve(ch.kind, ch.config));
    for (const ch of exploradorDigital.config.phases[1].challenges) for (let i = 0; i < ch.maxTries; i++) await g.submitChallenge(s, a.id, ch.id, {});
    const detail = await g.getGameDetail(s, await gameId());
    expect(detail.open!.phases[2].locked).toBe(true);
    await expect(g.submitChallenge(s, a.id, "pastas", {})).rejects.toMatchObject({ code: "locked" });
    const res = await g.finishAttempt(s, a.id);
    expect(res.passed).toBe(false);
    expect(res.guidance!.tips.join(" ")).toMatch(/As teclas certas/);
    expect(res.xpAwarded).toBe(0);
    expect(await points(s)).toBe(0);
  });

  it("partida completa: aprova, paga XP uma vez, registra histórico e concede medalha", async () => {
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    await expect(g.finishAttempt(s, a.id)).rejects.toMatchObject({ code: "incomplete" });
    await play(s, a.id);
    const res = await g.finishAttempt(s, a.id);
    expect(res).toMatchObject({ passed: true, percent: 100, stars: 3, xpAwarded: 100, alreadyCompleted: false });
    expect(res.newAchievements.map((x) => x.name)).toEqual(["Explorador Digital"]);
    expect(await points(s)).toBe(100);
    const att = await testDb.queryOne<any>(`SELECT * FROM game_attempts WHERE id=$1`, [a.id]);
    expect(att).toMatchObject({ status: "passed", ended_reason: "completed", score_percent: 100, xp_awarded: 100 });
    const prog = await testDb.queryOne<any>(`SELECT * FROM student_game_progress WHERE student_id=$1`, [s]);
    expect(prog).toMatchObject({ attempts: 1, completed: true, best_percent: 100, xp_awarded: 100 });
    expect(Number((await testDb.queryOne<any>(`SELECT COUNT(*)::int AS n FROM scores WHERE student_id=$1`, [s]))!.n)).toBe(1);
  });

  it("finalizar de novo (duplo clique) não duplica XP nem medalha", async () => {
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    await play(s, a.id);
    const [r1, r2] = await Promise.all([g.finishAttempt(s, a.id), g.finishAttempt(s, a.id).catch((e) => e)]);
    expect(r1.xpAwarded).toBe(100);
    const again = await g.finishAttempt(s, a.id);
    expect(again.xpAwarded).toBe(0);
    expect(again.alreadyCompleted).toBe(true);
    void r2;
    expect(await points(s)).toBe(100);
    expect(Number((await testDb.queryOne<any>(`SELECT COUNT(*)::int AS n FROM student_achievements WHERE student_id=$1`, [s]))!.n)).toBe(1);
    expect(Number((await testDb.queryOne<any>(`SELECT COUNT(*)::int AS n FROM scores WHERE student_id=$1`, [s]))!.n)).toBe(1);
  });

  it("jogar de novo depois de concluir: nova partida no histórico, sem XP extra", async () => {
    const s = await student("ana");
    const a1 = await g.startAttempt(s, await gameId());
    await play(s, a1.id);
    await g.finishAttempt(s, a1.id);
    const a2 = await g.startAttempt(s, await gameId());
    expect(a2.id).not.toBe(a1.id);
    await play(s, a2.id);
    const r2 = await g.finishAttempt(s, a2.id);
    expect(r2).toMatchObject({ passed: true, xpAwarded: 0, alreadyCompleted: true });
    expect(await points(s)).toBe(100);
    const prog = await testDb.queryOne<any>(`SELECT attempts FROM student_game_progress WHERE student_id=$1`, [s]);
    expect(Number(prog.attempts)).toBe(2);
  });

  it("reprovado pode tentar de novo e a melhor nota é preservada", async () => {
    const s = await student("ana");
    const a1 = await g.startAttempt(s, await gameId());
    await play(s, a1.id, { wrongAlways: true }).catch(() => undefined); // erra a fase 1 e trava
    const r1 = await g.finishAttempt(s, a1.id);
    expect(r1.passed).toBe(false);
    const a2 = await g.startAttempt(s, await gameId());
    expect(a2.id).not.toBe(a1.id);
    await play(s, a2.id);
    const r2 = await g.finishAttempt(s, a2.id);
    expect(r2.passed).toBe(true);
    const prog = await testDb.queryOne<any>(`SELECT * FROM student_game_progress WHERE student_id=$1`, [s]);
    expect(prog).toMatchObject({ attempts: 2, completed: true, best_percent: 100 });
    expect(await points(s)).toBe(100);
  });

  it("limite de tentativas é respeitado no servidor", async () => {
    await testDb.query(`UPDATE games SET max_attempts = 1`);
    const s = await student("ana");
    const a1 = await g.startAttempt(s, await gameId());
    await play(s, a1.id, { wrongAlways: true }).catch(() => undefined);
    await g.finishAttempt(s, a1.id);
    await expect(g.startAttempt(s, await gameId())).rejects.toMatchObject({ code: "limit" });
    const list = await g.listGamesForStudent(s, db());
    expect(list[0].state).toBe("limit");
  });

  it("tempo esgotado encerra a partida como 'time', sem XP", async () => {
    await testDb.query(`UPDATE games SET time_limit_seconds = 60`);
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    expect(a.expiresAt).toBeTruthy();
    await testDb.query(`UPDATE game_attempts SET expires_at = now() - interval '5 minutes'`);
    const r = await g.submitChallenge(s, a.id, "cerebro", { selected: ["cpu"] });
    expect(r.expired).toMatchObject({ passed: false, endedReason: "time", xpAwarded: 0 });
    const att = await testDb.queryOne<any>(`SELECT status, ended_reason FROM game_attempts WHERE id=$1`, [a.id]);
    expect(att).toMatchObject({ status: "failed", ended_reason: "time" });
    await expect(g.submitChallenge(s, a.id, "cerebro", {})).rejects.toMatchObject({ code: "conflict" });
  });

  it("uma partida só pode ser jogada pelo seu dono", async () => {
    const s = await student("ana");
    const outro = await student("bia");
    const a = await g.startAttempt(s, await gameId());
    await expect(g.submitChallenge(outro, a.id, "cerebro", {})).rejects.toMatchObject({ code: "not_found" });
    await expect(g.finishAttempt(outro, a.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("a versão da partida avança a cada resposta gravada (base do controle de concorrência)", async () => {
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    const ch = findChallenge(exploradorDigital.config, "cerebro")!.challenge;
    await g.submitChallenge(s, a.id, "cerebro", { selected: ["mouse"] });
    // A gravação usa `WHERE version = N`: uma resposta baseada em estado antigo não sobrescreve outra.
    const row = await testDb.queryOne<any>(`SELECT version FROM game_attempts WHERE id=$1`, [a.id]);
    expect(Number(row.version)).toBe(1);
    const r = await g.submitChallenge(s, a.id, "cerebro", solve(ch.kind, ch.config));
    expect(r.correct).toBe(true);
    expect(Number((await testDb.queryOne<any>(`SELECT version FROM game_attempts WHERE id=$1`, [a.id]))!.version)).toBe(2);
  });
});

describe("Central de Jogos — liberação e missões", () => {
  let trackId: string, moduleId: string, m1: string, m2: string;
  beforeEach(async () => {
    testDb = createTestDb();
    await seedGames(db());
    trackId = await mk("tracks", "name, slug", ["Trilha", "trilha"]);
    moduleId = await mk("modules", "track_id, name", [trackId, "Módulo"]);
    m1 = await mk("missions", "module_id, title, points_value", [moduleId, "Missão 1", 40]);
    m2 = await mk("missions", "module_id, title, points_value", [moduleId, "Missão 2", 60]);
  });

  it("regra de liberação: exige missão concluída antes", async () => {
    await testDb.query(`UPDATE games SET requires_mission_id=$1`, [m1]);
    const s = await student("ana");
    const list = await g.listGamesForStudent(s, db());
    expect(list[0].state).toBe("locked");
    expect(list[0].lockReason).toMatch(/Missão 1/);
    await expect(g.startAttempt(s, await gameId())).rejects.toMatchObject({ code: "locked" });
    await testDb.query(`INSERT INTO mission_attempts (student_id, mission_id, status) VALUES ($1,$2,'concluida')`, [s, m1]);
    expect((await g.listGamesForStudent(s, db()))[0].state).toBe("available");
    await g.startAttempt(s, await gameId());
  });

  it("regra de liberação: exige outro jogo concluído antes (sem mexer nas missões)", async () => {
    const first = await gameId();
    const second = await mk("games", "code, title, status, config", ["jogo-2", "Jogo 2", "published", JSON.stringify(exploradorDigital.config)]);
    await testDb.query(`UPDATE games SET requires_game_id=$1 WHERE id=$2`, [first, second]);
    const s = await student("ana");
    await expect(g.startAttempt(s, second)).rejects.toMatchObject({ code: "locked" });
    const a = await g.startAttempt(s, first);
    await play(s, a.id);
    await g.finishAttempt(s, a.id);
    await g.startAttempt(s, second);
    expect(Number((await testDb.queryOne<any>(`SELECT COUNT(*)::int AS n FROM mission_attempts`))!.n)).toBe(0);
  });

  it("jogo que conclui a missão: aprova → missão concluída com pontos creditados uma única vez", async () => {
    await testDb.query(`UPDATE games SET mission_id=$1, completes_mission=true`, [m2]);
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    await play(s, a.id);
    const res = await g.finishAttempt(s, a.id);
    expect(res.missionCompleted).toBe(true);
    expect(await points(s)).toBe(100 + 60);
    const ma = await testDb.queryOne<any>(`SELECT status FROM mission_attempts WHERE student_id=$1 AND mission_id=$2`, [s, m2]);
    expect(ma.status).toBe("concluida");
    // Repetir não credita a missão de novo.
    const a2 = await g.startAttempt(s, await gameId());
    await play(s, a2.id);
    await g.finishAttempt(s, a2.id);
    expect(await points(s)).toBe(160);
  });

  it("reprovado NÃO conclui a missão", async () => {
    await testDb.query(`UPDATE games SET mission_id=$1, completes_mission=true`, [m2]);
    const s = await student("ana");
    const a = await g.startAttempt(s, await gameId());
    await play(s, a.id, { wrongAlways: true }).catch(() => undefined);
    const res = await g.finishAttempt(s, a.id);
    expect(res.missionCompleted).toBe(false);
    expect(await testDb.queryOne(`SELECT 1 FROM mission_attempts WHERE student_id=$1`, [s])).toBeNull();
  });

  it("jogo ligado à missão aparece para o cartão da missão", async () => {
    await testDb.query(`UPDATE games SET mission_id=$1`, [m1]);
    const map = await g.listPublishedGamesByMission([m1, m2], "professional");
    expect(Object.keys(map)).toEqual([m1]);
    await testDb.query(`UPDATE games SET status='draft'`);
    expect(await g.listPublishedGamesByMission([m1], "professional")).toEqual({});
  });
});

describe("Central de Jogos — administração", () => {
  beforeEach(async () => {
    testDb = createTestDb();
  });
  const meta = (over: Record<string, unknown> = {}) => ({ code: "novo-jogo", title: "Novo jogo", ...over });

  it("cria rascunho, não publica configuração inválida e publica depois de corrigir", async () => {
    const adm = await mk("users", "email, password_hash, name, role", ["a@x.com", "h", "Admin", "admin"]);
    const created = await admin.createGame(adm, meta(), { phases: [] });
    expect(created.status).toBe("draft");
    await expect(admin.setGameStatus(created.id, "published")).rejects.toMatchObject({ code: "invalid" });
    const updated = await admin.updateGame(created.id, meta({ passPercent: 80, maxAttempts: 2 }), (await import("@/lib/games/content/explorador-digital")).exploradorDigital.config);
    expect(updated).toMatchObject({ passPercent: 80, maxAttempts: 2 });
    expect((await admin.setGameStatus(created.id, "published")).status).toBe("published");
    expect((await admin.setGameStatus(created.id, "draft")).status).toBe("draft");
  });

  it("valida código único, vínculos e regras", async () => {
    const adm = await mk("users", "email, password_hash, name, role", ["a@x.com", "h", "Admin", "admin"]);
    await admin.createGame(adm, meta(), { phases: [] });
    await expect(admin.createGame(adm, meta(), { phases: [] })).rejects.toMatchObject({ code: "conflict" });
    await expect(admin.createGame(adm, meta({ code: "x" }), {})).rejects.toMatchObject({ code: "invalid" });
    await expect(admin.createGame(adm, meta({ code: "outro", missionId: "11111111-1111-4111-8111-111111111111" }), {})).rejects.toMatchObject({ code: "invalid" });
    await expect(admin.createGame(adm, meta({ code: "outro", completesMission: true }), {})).rejects.toMatchObject({ code: "invalid" });
    await expect(admin.createGame(adm, meta({ code: "outro", passPercent: 0 }), {})).rejects.toMatchObject({ code: "invalid" });
  });

  it("publicado não aceita ser salvo com configuração quebrada", async () => {
    const adm = await mk("users", "email, password_hash, name, role", ["a@x.com", "h", "Admin", "admin"]);
    const cfg = (await import("@/lib/games/content/explorador-digital")).exploradorDigital.config;
    const created = await admin.createGame(adm, meta(), cfg);
    await admin.setGameStatus(created.id, "published");
    await expect(admin.updateGame(created.id, meta(), { phases: [] })).rejects.toMatchObject({ code: "invalid" });
  });
});

void allChallenges;
