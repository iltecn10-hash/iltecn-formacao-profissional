import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/assignments/queries", () => ({
  listAssignmentsForStaff: vi.fn(async () => []),
  listAssignmentsForStudent: vi.fn(async () => []),
  createAssignment: vi.fn(async () => ({ id: "1" })),
  submitAssignment: vi.fn(async () => ({ id: "1" })),
  evaluateSubmission: vi.fn(),
  deleteAssignment: vi.fn(async () => "deleted"),
  updateAssignment: vi.fn(),
  setAssignmentClosed: vi.fn(),
  getFileForDownload: vi.fn(async () => null),
}));

import { getSession } from "@/lib/auth";
import * as Q from "@/modules/assignments/queries";
import * as root from "@/app/api/assignments/route";
import * as item from "@/app/api/assignments/[id]/route";
import * as submit from "@/app/api/assignments/[id]/submit/route";
import * as evaluate from "@/app/api/assignments/submissions/[sid]/evaluate/route";
import * as download from "@/app/api/assignments/files/[fileId]/route";

const ID = "44444444-4444-4444-8444-444444444444";
const as = (role: SessionPayload["role"] | null) =>
  vi.mocked(getSession).mockResolvedValue(role ? { userId: "u", email: "u@x.com", name: "U", role } : null);
const form = (extra: Record<string, string> = {}) => {
  const f = new FormData();
  f.set("classId", ID);
  f.set("title", "Atividade");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return new NextRequest("http://localhost/api/x", { method: "POST", body: f });
};
const json = (body: unknown) =>
  new NextRequest("http://localhost/api/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("API de atividades — papéis", () => {
  it.each([null, "student", "coordinator"] as const)("%s não cria atividade (403)", async (role) => {
    as(role);
    expect((await root.POST(form())).status).toBe(403);
    expect(Q.createAssignment).not.toHaveBeenCalled();
  });
  it("professor cria (201) e título curto é recusado", async () => {
    as("teacher");
    expect((await root.POST(form())).status).toBe(201);
    expect((await root.POST(form({ title: "a" }))).status).toBe(400);
  });
  it.each([null, "teacher", "admin", "coordinator"] as const)("%s não entrega (só aluno)", async (role) => {
    as(role);
    const res = await submit.POST(form(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(403);
  });
  it("aluno entrega (201)", async () => {
    as("student");
    expect((await submit.POST(form(), { params: Promise.resolve({ id: ID }) })).status).toBe(201);
  });
  it.each([null, "student", "coordinator"] as const)("%s não avalia nem exclui", async (role) => {
    as(role);
    expect((await evaluate.POST(json({ status: "evaluated", score: 5 }), { params: Promise.resolve({ sid: ID }) })).status).toBe(403);
    expect((await item.DELETE(new NextRequest("http://localhost/x", { method: "DELETE" }), { params: Promise.resolve({ id: ID }) })).status).toBe(403);
    expect(Q.evaluateSubmission).not.toHaveBeenCalled();
  });
  it("professor avalia; resultado inválido é recusado", async () => {
    as("teacher");
    const p = { params: Promise.resolve({ sid: ID }) };
    expect((await evaluate.POST(json({ status: "evaluated", score: 5 }), p)).status).toBe(200);
    expect((await evaluate.POST(json({ status: "x" }), p)).status).toBe(400);
  });
  it("download exige login e devolve 404 quando sem acesso", async () => {
    as(null);
    expect((await download.GET(new NextRequest("http://localhost/x"), { params: Promise.resolve({ fileId: ID }) })).status).toBe(401);
    as("student");
    expect((await download.GET(new NextRequest("http://localhost/x"), { params: Promise.resolve({ fileId: ID }) })).status).toBe(404);
  });
});
