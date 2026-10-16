import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));
vi.mock("@/modules/students/queries", () => ({ getStudentIdByUserId: vi.fn(async () => "aluno-dono") }));
const canView = vi.fn();
vi.mock("@/modules/students/access", () => ({
  canActorViewStudent: (...a: unknown[]) => canView(...a),
  studentScope: vi.fn(),
}));
const recordManualEvaluation = vi.fn(async () => ({ id: "ev" }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const listStaff = vi.fn(async (..._a: unknown[]) => [] as unknown[]);
vi.mock("@/modules/student-works/queries", () => ({
  getStudentWorkById: vi.fn(async () => ({ id: "w1", student_id: "aluno-X" })),
  listWorkComments: vi.fn(async () => []), addWorkComment: vi.fn(async () => ({ id: "c" })),
  listStudentWorkVersions: vi.fn(async () => []), listWorkEvaluations: vi.fn(async () => []),
  recordManualEvaluation: (...a: unknown[]) => recordManualEvaluation(...(a as [])),
  listStudentWorksForStaff: (...a: unknown[]) => listStaff(...a),
  listStudentWorksByStudent: vi.fn(async () => []),
  WorkNotSubmittedError: class extends Error {},
}));
vi.mock("@/modules/reports/queries", () => ({ getStudentReport: vi.fn(async () => ({ student: { id: "aluno-X" } })) }));

const ctx = { params: Promise.resolve({ id: "w1" }) };
const req = (m = "GET", body?: unknown) =>
  new NextRequest("http://x/a", { method: m, body: body ? JSON.stringify(body) : undefined });
const staff = (role: string) => getSession.mockResolvedValue({ userId: "u1", email: "e", name: "n", role });

const routes = {
  work: await import("@/app/api/student-works/[id]/route"),
  comments: await import("@/app/api/student-works/[id]/comments/route"),
  versions: await import("@/app/api/student-works/[id]/versions/route"),
  evaluations: await import("@/app/api/student-works/[id]/evaluations/route"),
  evaluate: await import("@/app/api/student-works/[id]/evaluate/route"),
  list: await import("@/app/api/student-works/route"),
  report: await import("@/app/api/reports/student/[id]/route"),
};

const calls: [string, () => Promise<Response>][] = [
  ["GET trabalho", () => routes.work.GET(req(), ctx)],
  ["GET comentários", () => routes.comments.GET(req(), ctx)],
  ["POST comentário", () => routes.comments.POST(req("POST", { body: "oi" }), ctx)],
  ["GET versões", () => routes.versions.GET(req(), ctx)],
  ["GET avaliações", () => routes.evaluations.GET(req(), ctx)],
  ["POST avaliar", () => routes.evaluate.POST(req("POST", { passed: true }), ctx)],
  ["GET relatório do aluno", () => routes.report.GET(req(), ctx)],
];

describe("equipe só acessa alunos do seu escopo (trabalhos e relatórios)", () => {
  beforeEach(() => { canView.mockReset(); recordManualEvaluation.mockClear(); listStaff.mockClear(); });

  it.each(["teacher", "coordinator"])("%s FORA do escopo: 403 em todas as rotas, sem gravar nada", async (role) => {
    staff(role); canView.mockResolvedValue(false);
    for (const [name, call] of calls) expect((await call()).status, name).toBe(403);
    expect(recordManualEvaluation).not.toHaveBeenCalled();
  });

  it.each(["teacher", "coordinator", "admin"])("%s DENTRO do escopo: acesso normal", async (role) => {
    staff(role); canView.mockResolvedValue(true);
    expect((await routes.work.GET(req(), ctx)).status).toBe(200);
    expect((await routes.evaluate.POST(req("POST", { passed: true }), ctx)).status).toBe(201);
    expect((await routes.report.GET(req(), ctx)).status).toBe(200);
    expect(canView).toHaveBeenCalledWith({ userId: "u1", role }, expect.any(String));
  });

  it("a consulta usa o ator da SESSÃO e a lista da equipe recebe esse ator", async () => {
    staff("teacher");
    await routes.list.GET(req());
    expect(listStaff.mock.calls[0][0]).toEqual({ userId: "u1", role: "teacher" });
  });

  it("aluno continua só no próprio trabalho (sem consultar escopo de equipe)", async () => {
    getSession.mockResolvedValue({ userId: "u2", email: "e", name: "n", role: "student" });
    expect((await routes.work.GET(req(), ctx)).status).toBe(403); // dono é "aluno-dono", trabalho é de "aluno-X"
    expect(canView).not.toHaveBeenCalled();
  });
});
