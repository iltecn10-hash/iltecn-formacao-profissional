import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/students/queries", () => ({
  resetStudentPassword: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { resetStudentPassword } from "@/modules/students/queries";
import { POST } from "@/app/api/students/[id]/reset-password/route";

const ID = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ id: ID }) };
const req = (body: unknown = {}) =>
  new NextRequest("http://localhost/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
function as(role: SessionPayload["role"] | null) {
  vi.mocked(getSession).mockResolvedValue(role ? { userId: "u1", email: "u@x.com", name: "U", role } : null);
}

describe("POST /api/students/[id]/reset-password", () => {
  beforeEach(() => {
    vi.mocked(resetStudentPassword).mockReset();
    vi.mocked(resetStudentPassword).mockResolvedValue({ name: "Ana", email: "a@x.com" });
  });

  it.each([null, "student"] as const)("recusa %s com 403", async (role) => {
    as(role);
    expect((await POST(req(), params)).status).toBe(403);
    expect(resetStudentPassword).not.toHaveBeenCalled();
  });

  it.each(["admin", "teacher", "coordinator"] as const)("%s recebe senha provisória de 8 caracteres", async (role) => {
    as(role);
    const res = await POST(req(), params);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.temporaryPassword).toMatch(/^[a-z2-9]{8}$/);
    expect(vi.mocked(resetStudentPassword).mock.calls[0][0]).toEqual({ userId: "u1", role });
  });

  it("aceita senha escolhida e rejeita curta", async () => {
    as("admin");
    expect((await (await POST(req({ password: "minhaSenha" }), params)).json()).temporaryPassword).toBe("minhaSenha");
    expect((await POST(req({ password: "123" }), params)).status).toBe(400);
  });

  it("aluno fora do escopo vira 404", async () => {
    as("teacher");
    vi.mocked(resetStudentPassword).mockResolvedValue(null);
    expect((await POST(req(), params)).status).toBe(404);
  });
});
