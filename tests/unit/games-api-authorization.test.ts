import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/students/queries", () => ({
  getStudentIdByUserId: vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111"),
}));
vi.mock("@/modules/games/queries", async () => {
  class GameError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    GameError,
    listGamesForStudent: vi.fn().mockResolvedValue([]),
    getGameDetail: vi.fn().mockResolvedValue({ id: "x" }),
    startAttempt: vi.fn().mockResolvedValue({ id: "a" }),
    submitChallenge: vi.fn().mockResolvedValue({ correct: true }),
    finishAttempt: vi.fn().mockResolvedValue({ passed: true }),
  };
});
vi.mock("@/modules/games/results", async () => {
  class ResultsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    ResultsError,
    getGameResults: vi.fn().mockResolvedValue({ students: [] }),
    listGamesForStaff: vi.fn().mockResolvedValue([]),
  };
});
vi.mock("@/modules/games/admin", async () => {
  class GameAdminError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    GameAdminError,
    listAdminGames: vi.fn().mockResolvedValue([]),
    createGame: vi.fn().mockResolvedValue({ id: "g" }),
    getAdminGame: vi.fn().mockResolvedValue({ id: "g" }),
    updateGame: vi.fn().mockResolvedValue({ id: "g" }),
    setGameStatus: vi.fn().mockResolvedValue({ id: "g" }),
  };
});

import { getSession } from "@/lib/auth";
import { submitChallenge, startAttempt, finishAttempt, getGameDetail, GameError } from "@/modules/games/queries";
import { getGameResults } from "@/modules/games/results";
import { createGame, updateGame, setGameStatus } from "@/modules/games/admin";
import { GET as listGames } from "@/app/api/games/route";
import { GET as getGame } from "@/app/api/games/[id]/route";
import { POST as start } from "@/app/api/games/[id]/start/route";
import { GET as results } from "@/app/api/games/[id]/results/route";
import { POST as answer } from "@/app/api/games/attempts/[attemptId]/answer/route";
import { POST as finish } from "@/app/api/games/attempts/[attemptId]/finish/route";
import { POST as adminCreate, GET as adminList } from "@/app/api/admin/games/route";
import { PUT as adminUpdate } from "@/app/api/admin/games/[id]/route";
import { POST as adminStatus } from "@/app/api/admin/games/[id]/status/route";

const mockSession = vi.mocked(getSession);
const ID = "22222222-2222-4222-8222-222222222222";
const idParams = { params: Promise.resolve({ id: ID }) };
const attParams = { params: Promise.resolve({ attemptId: ID }) };

function as(role: SessionPayload["role"] | null) {
  mockSession.mockResolvedValue(role ? { userId: "u1", email: "u@x.com", name: "U", role } : null);
}
const req = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/api/x", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("rotas do aluno: só aluno", () => {
  it.each(["admin", "teacher", "coordinator", null] as const)("barra %s em detalhe/iniciar/responder/finalizar", async (role) => {
    as(role);
    expect((await getGame(new Request("http://x"), idParams)).status).toBe(403);
    expect((await start(new Request("http://x", { method: "POST" }), idParams)).status).toBe(403);
    expect((await answer(req({ challengeId: "c", submission: {} }), attParams)).status).toBe(403);
    expect((await finish(new Request("http://x", { method: "POST" }), attParams)).status).toBe(403);
    expect(startAttempt).not.toHaveBeenCalled();
    expect(submitChallenge).not.toHaveBeenCalled();
    expect(finishAttempt).not.toHaveBeenCalled();
    expect(getGameDetail).not.toHaveBeenCalled();
  });

  it("aluno responde; ids inválidos e corpo inválido são recusados", async () => {
    as("student");
    expect((await answer(req({ challengeId: "c", submission: { selected: ["a"] } }), attParams)).status).toBe(200);
    expect(submitChallenge).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", ID, "c", { selected: ["a"] });
    expect((await answer(req({ submission: {} }), attParams)).status).toBe(400);
    expect((await answer(req({ challengeId: "c" }), { params: Promise.resolve({ attemptId: "nao-uuid" }) })).status).toBe(400);
    expect((await start(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "x" }) })).status).toBe(400);
  });

  it("a rota não aceita nota/XP vindos do navegador (só challengeId e submission chegam ao serviço)", async () => {
    as("student");
    await answer(req({ challengeId: "c", submission: {}, score: 100, xp: 999, correct: true }), attParams);
    expect(vi.mocked(submitChallenge).mock.calls[0]).toHaveLength(4);
  });

  it("erro de regra vira status HTTP claro (limite = 429, bloqueado = 423)", async () => {
    as("student");
    vi.mocked(startAttempt).mockRejectedValueOnce(new GameError("limit", "Sem tentativas."));
    expect((await start(new Request("http://x", { method: "POST" }), idParams)).status).toBe(429);
    vi.mocked(startAttempt).mockRejectedValueOnce(new GameError("locked", "Bloqueado."));
    expect((await start(new Request("http://x", { method: "POST" }), idParams)).status).toBe(423);
    vi.mocked(startAttempt).mockRejectedValueOnce(new Error("boom: detalhe interno"));
    const res = await start(new Request("http://x", { method: "POST" }), idParams);
    expect((await res.json()).error).not.toMatch(/boom/);
  });

  it("listagem exige login", async () => {
    as(null);
    expect((await listGames()).status).toBe(403);
    as("student");
    expect((await listGames()).status).toBe(200);
  });
});

describe("resultados: só equipe", () => {
  it.each(["student", null] as const)("barra %s", async (role) => {
    as(role);
    expect((await results(new NextRequest("http://localhost/api/x"), idParams)).status).toBe(403);
    expect(getGameResults).not.toHaveBeenCalled();
  });
  it.each(["admin", "teacher", "coordinator"] as const)("libera %s e repassa o perfil ao serviço", async (role) => {
    as(role);
    expect((await results(new NextRequest("http://localhost/api/x"), idParams)).status).toBe(200);
    expect(getGameResults).toHaveBeenCalledWith({ userId: "u1", role }, ID, { classId: undefined });
  });
  it("turma inválida é recusada", async () => {
    as("teacher");
    expect((await results(new NextRequest("http://localhost/api/x?classId=abc"), idParams)).status).toBe(400);
  });
});

describe("administração: só administrador", () => {
  it.each(["teacher", "coordinator", "student", null] as const)("barra %s", async (role) => {
    as(role);
    expect((await adminList()).status).toBe(403);
    expect((await adminCreate(req({ meta: {} }))).status).toBe(403);
    expect((await adminUpdate(req({ meta: {} }, "PUT"), idParams)).status).toBe(403);
    expect((await adminStatus(req({ status: "published" }), idParams)).status).toBe(403);
    expect(createGame).not.toHaveBeenCalled();
    expect(updateGame).not.toHaveBeenCalled();
    expect(setGameStatus).not.toHaveBeenCalled();
  });
  it("administrador cria, edita e publica", async () => {
    as("admin");
    expect((await adminCreate(req({ meta: { code: "x" }, config: {} }))).status).toBe(201);
    expect((await adminUpdate(req({ meta: {}, config: {} }, "PUT"), idParams)).status).toBe(200);
    expect((await adminStatus(req({ status: "published" }), idParams)).status).toBe(200);
    expect((await adminStatus(req({ status: "banana" }), idParams)).status).toBe(400);
  });
});
