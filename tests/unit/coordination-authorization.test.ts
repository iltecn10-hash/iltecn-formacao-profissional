import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/coordination/queries", () => ({
  listCoordinationMembers: vi.fn(async () => []),
  createCoordinationMember: vi.fn(async () => ({ id: "1" })),
}));
vi.mock("@/modules/registry/records", async () => {
  class RecordError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return {
    RecordError,
    updateCoordinator: vi.fn(),
    setCoordinatorActive: vi.fn(),
    deleteCoordinator: vi.fn(async () => "deleted"),
  };
});

import { getSession } from "@/lib/auth";
import * as C from "@/modules/coordination/queries";
import * as list from "@/app/api/coordination/route";
import * as item from "@/app/api/coordination/[id]/route";

const ID = "44444444-4444-4444-8444-444444444444";
const params = { params: Promise.resolve({ id: ID }) };
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const as = (role: SessionPayload["role"] | null) =>
  vi.mocked(getSession).mockResolvedValue(role ? { userId: "u", email: "u@x.com", name: "U", role } : null);
const valid = { name: "Maria", email: "m@x.com", password: "Diretor7x9", schoolId: ID, position: "diretor" };

beforeEach(() => vi.clearAllMocks());

describe("API de coordenação e direção", () => {
  it.each([null, "student", "teacher", "coordinator"] as const)("%s não cadastra nem lista (403)", async (role) => {
    as(role);
    expect((await list.POST(req("POST", valid))).status).toBe(403);
    expect((await list.GET()).status).toBe(403);
    expect((await item.DELETE(req("DELETE"), params)).status).toBe(403);
    expect((await item.PATCH(req("PATCH", { active: false }), params)).status).toBe(403);
    expect(C.createCoordinationMember).not.toHaveBeenCalled();
  });

  it("admin cadastra diretor (201)", async () => {
    as("admin");
    expect((await list.POST(req("POST", valid))).status).toBe(201);
    expect(C.createCoordinationMember).toHaveBeenCalled();
  });

  it("valida cargo, e-mail e senha fraca", async () => {
    as("admin");
    expect((await list.POST(req("POST", { ...valid, position: "chefe" }))).status).toBe(400);
    expect((await list.POST(req("POST", { ...valid, email: "x" }))).status).toBe(400);
    expect((await list.POST(req("POST", { ...valid, password: "123456" }))).status).toBe(400);
    expect(C.createCoordinationMember).not.toHaveBeenCalled();
  });

  it("admin exclui (200)", async () => {
    as("admin");
    expect((await item.DELETE(req("DELETE"), params)).status).toBe(200);
  });
});
