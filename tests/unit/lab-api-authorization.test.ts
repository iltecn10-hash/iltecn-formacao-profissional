import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/students/queries", () => ({
  getStudentIdByUserId: vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111"),
}));
vi.mock("@/modules/lab/queries", async () => {
  class LabError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    LabError,
    getLabLesson: vi.fn().mockResolvedValue({ id: "x" }),
    submitActivity: vi.fn().mockResolvedValue({ correct: true }),
    completeLabLesson: vi.fn().mockResolvedValue({ alreadyCompleted: false }),
  };
});
vi.mock("@/modules/lab/monitor", () => ({
  getLabMonitor: vi.fn().mockResolvedValue({ students: [], generatedAt: "", summary: {} }),
}));
vi.mock("@/modules/lab/content", async () => {
  const { z } = await import("zod");
  return {
    activityInputSchema: z.object({ title: z.string().min(2) }).passthrough(),
    createActivity: vi.fn().mockResolvedValue({ id: "a" }),
    listActivitiesForAdmin: vi.fn().mockResolvedValue([]),
    updateActivity: vi.fn().mockResolvedValue({ id: "a" }),
    deactivateActivity: vi.fn().mockResolvedValue(undefined),
  };
});

import { getSession } from "@/lib/auth";
import { submitActivity, getLabLesson, LabError } from "@/modules/lab/queries";
import { GET as getLesson } from "@/app/api/lab/lessons/[id]/route";
import { POST as completeLesson } from "@/app/api/lab/lessons/[id]/complete/route";
import { POST as submit } from "@/app/api/lab/activities/[id]/submit/route";
import { GET as monitor } from "@/app/api/lab/monitor/route";
import { POST as createAct } from "@/app/api/lab/missions/[id]/activities/route";
import { PATCH as patchAct, DELETE as deleteAct } from "@/app/api/lab/activities/[id]/route";

const mockSession = vi.mocked(getSession);
const ID = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ id: ID }) };

function as(role: SessionPayload["role"] | null) {
  mockSession.mockResolvedValue(
    role ? { userId: "u1", email: "u@x.com", name: "U", role } : null
  );
}
const req = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/api/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe("rotas do aluno (aula, enviar, concluir)", () => {
  it.each(["admin", "teacher", "coordinator", null] as const)("barra %s", async (role) => {
    as(role);
    expect((await getLesson(new Request("http://x"), params)).status).toBe(403);
    expect((await completeLesson(new Request("http://x", { method: "POST" }), params)).status).toBe(403);
    expect((await submit(req({ submission: {} }), params)).status).toBe(403);
    expect(submitActivity).not.toHaveBeenCalled();
  });

  it("aluno passa; id não-UUID e corpo inválido dão 400", async () => {
    as("student");
    expect((await submit(req({ submission: { selected: ["a"] } }), params)).status).toBe(200);
    expect((await submit(req({ submission: {} }), { params: Promise.resolve({ id: "x" }) })).status).toBe(400);
    const bad = new NextRequest("http://x", { method: "POST", body: "isto não é json" });
    expect((await submit(bad, params)).status).toBe(400);
  });

  it("recusa corpo gigante", async () => {
    as("student");
    const big = new NextRequest("http://x", { method: "POST", body: JSON.stringify({ submission: "a".repeat(40000) }) });
    expect((await submit(big, params)).status).toBe(413);
  });

  it("aula bloqueada vira 423 com mensagem amigável", async () => {
    as("student");
    vi.mocked(getLabLesson).mockRejectedValueOnce(new LabError("locked", "Termine a aula anterior"));
    const r = await getLesson(new Request("http://x"), params);
    expect(r.status).toBe(423);
    expect((await r.json()).error).toContain("aula anterior");
  });

  it("erro inesperado não vaza detalhes", async () => {
    as("student");
    vi.mocked(getLabLesson).mockRejectedValueOnce(new Error('relation "secret_table" does not exist'));
    const r = await getLesson(new Request("http://x"), params);
    expect(r.status).toBe(400);
    expect(JSON.stringify(await r.json())).not.toContain("secret_table");
  });
});

describe("monitor do professor", () => {
  it("aluno e anônimo são barrados; equipe passa", async () => {
    for (const role of ["student", null] as const) {
      as(role);
      expect((await monitor(new NextRequest("http://x/api/lab/monitor"))).status).toBe(403);
    }
    for (const role of ["admin", "teacher", "coordinator"] as const) {
      as(role);
      expect((await monitor(new NextRequest("http://x/api/lab/monitor"))).status).toBe(200);
    }
  });

  it("turma inválida dá 400", async () => {
    as("teacher");
    expect((await monitor(new NextRequest("http://x/api/lab/monitor?classId=abc"))).status).toBe(400);
  });
});

describe("gestão de atividades (só admin)", () => {
  it.each(["teacher", "coordinator", "student", null] as const)("barra %s", async (role) => {
    as(role);
    expect((await createAct(req({ title: "Teste" }), params)).status).toBe(403);
    expect((await patchAct(req({ title: "Teste" }, "PATCH") as NextRequest, params)).status).toBe(403);
    expect((await deleteAct(new Request("http://x", { method: "DELETE" }), params)).status).toBe(403);
  });

  it("admin passa; dados inválidos dão 400", async () => {
    as("admin");
    expect((await createAct(req({ title: "Teste" }), params)).status).toBe(201);
    expect((await createAct(req({ title: "x" }), params)).status).toBe(400);
    expect((await deleteAct(new Request("http://x", { method: "DELETE" }), params)).status).toBe(200);
  });
});
