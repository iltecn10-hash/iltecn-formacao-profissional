import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/users/queries", () => ({
  listManagedUsers: vi.fn(),
  resetUserPassword: vi.fn(),
  changeOwnPassword: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { listManagedUsers, resetUserPassword, changeOwnPassword } from "@/modules/users/queries";
import { GET as listRoute } from "@/app/api/users/route";
import { POST as resetRoute } from "@/app/api/users/[id]/reset-password/route";
import { POST as changeRoute } from "@/app/api/account/password/route";

const ID = "33333333-3333-4333-8333-333333333333";
const params = { params: Promise.resolve({ id: ID }) };
const post = (body: unknown = {}) =>
  new NextRequest("http://localhost/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
function as(role: SessionPayload["role"] | null) {
  vi.mocked(getSession).mockResolvedValue(role ? { userId: "u1", email: "u@x.com", name: "U", role } : null);
}

beforeEach(() => {
  vi.mocked(listManagedUsers).mockReset().mockResolvedValue([]);
  vi.mocked(resetUserPassword).mockReset().mockResolvedValue({ name: "Ana", email: "a@x.com", role: "student" });
  vi.mocked(changeOwnPassword).mockReset().mockResolvedValue("ok");
});

describe("GET /api/users e POST /api/users/[id]/reset-password", () => {
  it.each([null, "student"] as const)("recusa %s com 403", async (role) => {
    as(role);
    expect((await listRoute()).status).toBe(403);
    expect((await resetRoute(post(), params)).status).toBe(403);
    expect(listManagedUsers).not.toHaveBeenCalled();
    expect(resetUserPassword).not.toHaveBeenCalled();
  });

  it.each(["admin", "coordinator", "teacher"] as const)("%s lista e redefine, com o ator da sessão", async (role) => {
    as(role);
    expect((await listRoute()).status).toBe(200);
    expect(vi.mocked(listManagedUsers).mock.calls[0][0]).toEqual({ userId: "u1", role });
    const res = await resetRoute(post(), params);
    expect(res.status).toBe(200);
    expect((await res.json()).temporaryPassword).toMatch(/^[a-z2-9]{8}$/);
    expect(vi.mocked(resetUserPassword).mock.calls[0][0]).toEqual({ userId: "u1", role });
  });

  it("fora do escopo vira 404 e id inválido 400", async () => {
    as("teacher");
    vi.mocked(resetUserPassword).mockResolvedValue(null);
    expect((await resetRoute(post(), params)).status).toBe(404);
    expect((await resetRoute(post(), { params: Promise.resolve({ id: "x" }) })).status).toBe(400);
  });
});

describe("POST /api/account/password", () => {
  it("sem sessão: 401", async () => {
    as(null);
    expect((await changeRoute(post({ currentPassword: "a", newPassword: "b" }))).status).toBe(401);
  });

  it("aplica a política por perfil antes de tocar no banco", async () => {
    as("admin");
    const res = await changeRoute(post({ currentPassword: "x", newPassword: "123456" }));
    expect(res.status).toBe(400);
    expect(changeOwnPassword).not.toHaveBeenCalled();
    as("student");
    expect((await changeRoute(post({ currentPassword: "x", newPassword: "123456" }))).status).toBe(200);
  });

  it("usa o usuário da SESSÃO (nunca um id do corpo) e traduz os erros", async () => {
    as("teacher");
    await changeRoute(post({ currentPassword: "Antiga1x", newPassword: "Nova2026x", userId: "outro" }));
    expect(vi.mocked(changeOwnPassword).mock.calls[0][0]).toBe("u1");
    vi.mocked(changeOwnPassword).mockResolvedValue("wrong_current");
    expect((await changeRoute(post({ currentPassword: "x", newPassword: "Nova2026x" }))).status).toBe(400);
    vi.mocked(changeOwnPassword).mockResolvedValue("same_password");
    expect((await changeRoute(post({ currentPassword: "Nova2026x", newPassword: "Nova2026x" }))).status).toBe(400);
  });
});
