import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));
const resolveSchoolId = vi.fn();
vi.mock("@/modules/council/queries", () => {
  class CouncilForbiddenError extends Error {}
  class CouncilInvalidError extends Error {}
  return {
    CouncilForbiddenError, CouncilInvalidError,
    resolveSchoolId: (...a: unknown[]) => resolveSchoolId(...a),
    listSubjects: vi.fn(async () => []), createSubject: vi.fn(async () => ({ id: "s" })),
    setSubjectActive: vi.fn(async () => ({ id: "s" })), listPeriods: vi.fn(async () => []),
    updatePeriod: vi.fn(async () => ({ id: "p" })), listCriteria: vi.fn(async () => []),
    createCriterion: vi.fn(async () => ({ id: "c" })), updateCriterion: vi.fn(async () => ({ id: "c" })),
    listAssignments: vi.fn(async () => []), createAssignment: vi.fn(async () => ({ id: "a" })),
    setAssignmentActive: vi.fn(async () => true),
  };
});

const UUID = "11111111-1111-4111-8111-111111111111";
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://x${url}`, { method, body: body ? JSON.stringify(body) : undefined });
const ctx = { params: Promise.resolve({ id: UUID }) };

const routes = {
  disciplinas: await import("@/app/api/conselho/disciplinas/route"),
  disciplinasId: await import("@/app/api/conselho/disciplinas/[id]/route"),
  periodos: await import("@/app/api/conselho/periodos/route"),
  periodosId: await import("@/app/api/conselho/periodos/[id]/route"),
  criterios: await import("@/app/api/conselho/criterios/route"),
  criteriosId: await import("@/app/api/conselho/criterios/[id]/route"),
  vinculos: await import("@/app/api/conselho/vinculos/route"),
  vinculosId: await import("@/app/api/conselho/vinculos/[id]/route"),
};

const calls: [string, () => Promise<Response>][] = [
  ["GET disciplinas", () => routes.disciplinas.GET(req("/a"))],
  ["POST disciplinas", () => routes.disciplinas.POST(req("/a", "POST", { name: "Xadrez" }))],
  ["PATCH disciplinas/id", () => routes.disciplinasId.PATCH(req("/a", "PATCH", { active: false }), ctx)],
  ["GET periodos", () => routes.periodos.GET(req("/a"))],
  ["PATCH periodos/id", () => routes.periodosId.PATCH(req("/a", "PATCH", { status: "closed" }), ctx)],
  ["GET criterios", () => routes.criterios.GET(req("/a"))],
  ["POST criterios", () => routes.criterios.POST(req("/a", "POST", { label: "Algo novo", kind: "yesno" }))],
  ["PATCH criterios/id", () => routes.criteriosId.PATCH(req("/a", "PATCH", { active: false }), ctx)],
  ["GET vinculos", () => routes.vinculos.GET(req("/a"))],
  ["POST vinculos", () => routes.vinculos.POST(req("/a", "POST", { classId: UUID, subjectId: UUID, teacherId: UUID }))],
  ["PATCH vinculos/id", () => routes.vinculosId.PATCH(req("/a", "PATCH", { active: false }), ctx)],
];

describe("rotas do Conselho — autenticação e papéis", () => {
  beforeEach(() => { getSession.mockReset(); resolveSchoolId.mockReset(); resolveSchoolId.mockResolvedValue(UUID); });

  it.each(calls)("%s: 401 sem sessão", async (_n, call) => {
    getSession.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it.each(calls)("%s: 403 para aluno", async (_n, call) => {
    getSession.mockResolvedValue({ userId: UUID, role: "student" });
    expect((await call()).status).toBe(403);
  });

  it("equipe autorizada recebe sucesso", async () => {
    getSession.mockResolvedValue({ userId: UUID, role: "teacher" });
    expect((await routes.disciplinas.GET(req("/a"))).status).toBe(200);
    expect((await routes.disciplinas.POST(req("/a", "POST", { name: "Xadrez" }))).status).toBe(201);
  });

  it("escola fora do escopo (resolveSchoolId nulo) = 403", async () => {
    getSession.mockResolvedValue({ userId: UUID, role: "teacher" });
    resolveSchoolId.mockResolvedValue(null);
    expect((await routes.disciplinas.GET(req("/a?schoolId=" + UUID))).status).toBe(403);
    expect((await routes.periodos.GET(req("/a"))).status).toBe(403);
    expect((await routes.criterios.GET(req("/a"))).status).toBe(403);
  });

  it("valida o corpo (400) e o id da URL", async () => {
    getSession.mockResolvedValue({ userId: UUID, role: "admin" });
    expect((await routes.disciplinas.POST(req("/a", "POST", { name: "x" }))).status).toBe(400);
    expect((await routes.criterios.POST(req("/a", "POST", { label: "Algo novo", kind: "level" }))).status).toBe(400);
    expect((await routes.periodos.GET(req("/a?year=1900"))).status).toBe(400);
    const bad = { params: Promise.resolve({ id: "nao-e-uuid" }) };
    expect((await routes.vinculosId.PATCH(req("/a", "PATCH", { active: false }), bad)).status).toBe(400);
  });
});
