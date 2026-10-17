import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/classes/enrollments", () => ({
  getClassRoster: vi.fn(async () => ({ class: { id: "c", name: "5a", active: true }, enrolled: [], available: [] })),
  enrollInClass: vi.fn(),
  unenrollFromClass: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import * as Q from "@/modules/classes/enrollments";
import * as route from "@/app/api/classes/[id]/enrollments/route";

const CLASS = "44444444-4444-4444-8444-444444444444";
const STUDENT = "55555555-5555-4555-8555-555555555555";
const ctx = { params: Promise.resolve({ id: CLASS }) };
const as = (role: SessionPayload["role"] | null) =>
  vi.mocked(getSession).mockResolvedValue(role ? { userId: "u", email: "u@x.com", name: "U", role } : null);
const post = (body: unknown) =>
  new NextRequest("http://localhost/api/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("API de matrícula — papéis e validação", () => {
  it.each([null, "student"] as const)("%s não lista, matricula nem remove (403)", async (role) => {
    as(role);
    expect((await route.GET(new NextRequest("http://localhost/api/x"), ctx)).status).toBe(403);
    expect((await route.POST(post({ studentId: STUDENT }), ctx)).status).toBe(403);
    expect((await route.DELETE(new NextRequest(`http://localhost/api/x?studentId=${STUDENT}`, { method: "DELETE" }), ctx)).status).toBe(403);
    expect(Q.enrollInClass).not.toHaveBeenCalled();
    expect(Q.unenrollFromClass).not.toHaveBeenCalled();
  });

  it.each(["admin", "teacher", "coordinator"] as const)("%s matricula e remove", async (role) => {
    as(role);
    expect((await route.POST(post({ studentId: STUDENT }), ctx)).status).toBe(201);
    expect(Q.enrollInClass).toHaveBeenCalledWith({ userId: "u", role }, CLASS, STUDENT);
    expect((await route.DELETE(new NextRequest(`http://localhost/api/x?studentId=${STUDENT}`, { method: "DELETE" }), ctx)).status).toBe(200);
  });

  it("aluno inválido = 400", async () => {
    as("admin");
    expect((await route.POST(post({ studentId: "nao-e-uuid" }), ctx)).status).toBe(400);
  });
});
