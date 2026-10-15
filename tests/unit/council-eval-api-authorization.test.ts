import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));
const saveEvaluation = vi.fn();
vi.mock("@/modules/council/queries", () => {
  class CouncilForbiddenError extends Error {}
  class CouncilInvalidError extends Error {}
  return { CouncilForbiddenError, CouncilInvalidError, resolveSchoolId: vi.fn(async () => "11111111-1111-4111-8111-111111111111") };
});
vi.mock("@/modules/council/evaluations", () => {
  class EvaluationLockedError extends Error {}
  class EvaluationConflictError extends Error {}
  return {
    EvaluationLockedError, EvaluationConflictError,
    getSheet: vi.fn(async () => ({ students: [] })), saveEvaluation: (...a: unknown[]) => saveEvaluation(...a),
    reopenEvaluation: vi.fn(async () => ({ id: "e" })), listEvaluationEvents: vi.fn(async () => []),
    getPanel: vi.fn(async () => ({ rows: [] })), getStudentCouncilReport: vi.fn(async () => ({ entries: [] })),
    getClassReport: vi.fn(async () => ({ class_name: "x", criteriaLabels: [], students: [], subjects: [] })),
    classReportToCsv: vi.fn(() => "csv"),
  };
});

const UUID = "11111111-1111-4111-8111-111111111111";
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://x${url}`, { method, body: body ? JSON.stringify(body) : undefined });
const idCtx = { params: Promise.resolve({ id: UUID }) };
const stCtx = { params: Promise.resolve({ studentId: UUID }) };

const r = {
  av: await import("@/app/api/conselho/avaliacoes/route"),
  reabrir: await import("@/app/api/conselho/avaliacoes/[id]/reabrir/route"),
  hist: await import("@/app/api/conselho/avaliacoes/[id]/historico/route"),
  painel: await import("@/app/api/conselho/painel/route"),
  aluno: await import("@/app/api/conselho/relatorios/aluno/[studentId]/route"),
  turma: await import("@/app/api/conselho/relatorios/turma/route"),
};
const q = `assignmentId=${UUID}&periodId=${UUID}`;
const body = { assignmentId: UUID, periodId: UUID, studentId: UUID, answers: { rendimento: "media" } };

const calls: [string, () => Promise<Response>][] = [
  ["GET avaliacoes", () => r.av.GET(req(`/a?${q}`))],
  ["PUT avaliacoes", () => r.av.PUT(req("/a", "PUT", body))],
  ["POST reabrir", () => r.reabrir.POST(req("/a", "POST", { reason: "erro" }), idCtx)],
  ["GET historico", () => r.hist.GET(req("/a"), idCtx)],
  ["GET painel", () => r.painel.GET(req(`/a?periodId=${UUID}`))],
  ["GET relatorio aluno", () => r.aluno.GET(req("/a"), stCtx)],
  ["GET relatorio turma", () => r.turma.GET(req(`/a?classId=${UUID}&periodId=${UUID}`))],
];

describe("rotas de avaliação do Conselho", () => {
  beforeEach(() => { getSession.mockReset(); saveEvaluation.mockReset(); saveEvaluation.mockResolvedValue({ id: "e" }); });

  it.each(calls)("%s: 401 sem sessão", async (_n, c) => {
    getSession.mockResolvedValue(null);
    expect((await c()).status).toBe(401);
  });
  it.each(calls)("%s: 403 para aluno", async (_n, c) => {
    getSession.mockResolvedValue({ userId: UUID, role: "student" });
    expect((await c()).status).toBe(403);
  });

  it("PUT usa o ator da SESSÃO e ignora campos extras (professor/escola/status)", async () => {
    getSession.mockResolvedValue({ userId: UUID, role: "teacher" });
    const res = await r.av.PUT(req("/a", "PUT", { ...body, teacherId: "x", status: "final", schoolId: "y" }));
    expect(res.status).toBe(200);
    const [actor, input] = saveEvaluation.mock.calls[0];
    expect(actor).toEqual({ userId: UUID, role: "teacher" });
    expect(Object.keys(input).sort()).toEqual(["answers", "assignmentId", "periodId", "studentId"]);
  });

  it("PUT valida corpo (400), tamanho (413) e traduz travada/conflito (409)", async () => {
    getSession.mockResolvedValue({ userId: UUID, role: "teacher" });
    expect((await r.av.PUT(req("/a", "PUT", { ...body, studentId: "nao-uuid" }))).status).toBe(400);
    expect((await r.av.PUT(req("/a", "PUT", { ...body, answers: { observacoes: "x".repeat(3000) } }))).status).toBe(400);
    expect((await r.av.PUT(req("/a", "PUT", { ...body, answers: { a: "x".repeat(40_000) } }))).status).toBe(413);
    const { EvaluationLockedError, EvaluationConflictError } = await import("@/modules/council/evaluations");
    saveEvaluation.mockRejectedValueOnce(new EvaluationLockedError());
    expect((await r.av.PUT(req("/a", "PUT", body))).status).toBe(409);
    saveEvaluation.mockRejectedValueOnce(new EvaluationConflictError());
    expect((await r.av.PUT(req("/a", "PUT", body))).status).toBe(409);
  });

  it("erro interno não vaza detalhes", async () => {
    getSession.mockResolvedValue({ userId: UUID, role: "teacher" });
    saveEvaluation.mockRejectedValueOnce(new Error("senha do banco: segredo"));
    const res = await r.av.PUT(req("/a", "PUT", body));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("segredo");
  });

  it("GET turma em CSV devolve cabeçalhos de download e sem cache", async () => {
    getSession.mockResolvedValue({ userId: UUID, role: "coordinator" });
    const res = await r.turma.GET(req(`/a?classId=${UUID}&periodId=${UUID}&format=csv`));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("csv");
  });
});
