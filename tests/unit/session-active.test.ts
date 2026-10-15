import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET = "segredo-de-teste";
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}));
const queryOne = vi.fn();
vi.mock("@/lib/db", () => ({ queryOne: (...a: unknown[]) => queryOne(...a) }));

const { createSessionToken, getSession } = await import("@/lib/auth");

const payload = { userId: "11111111-1111-4111-8111-111111111111", email: "a@x.com", name: "Antigo", role: "teacher" as const };

describe("getSession — usuário desativado e papel atual", () => {
  beforeEach(async () => { queryOne.mockReset(); cookieValue = await createSessionToken(payload); });

  it("sem cookie ou com token inválido: null (sem consultar o banco)", async () => {
    cookieValue = undefined;
    expect(await getSession()).toBeNull();
    cookieValue = "token.invalido.aqui";
    expect(await getSession()).toBeNull();
    expect(queryOne).not.toHaveBeenCalled();
  });

  it("usuário ativo: sessão válida", async () => {
    queryOne.mockResolvedValue({ active: true, role: "teacher", name: "Antigo", email: "a@x.com" });
    expect(await getSession()).toEqual(payload);
  });

  it("usuário DESATIVADO depois do login: null mesmo com token ainda válido", async () => {
    queryOne.mockResolvedValue({ active: false, role: "teacher", name: "Antigo", email: "a@x.com" });
    expect(await getSession()).toBeNull();
  });

  it("usuário apagado: null", async () => {
    queryOne.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });

  it("papel e nome vêm do BANCO, não do token (rebaixar um professor vale na hora)", async () => {
    queryOne.mockResolvedValue({ active: true, role: "student", name: "Nome Novo", email: "novo@x.com" });
    expect(await getSession()).toEqual({ ...payload, role: "student", name: "Nome Novo", email: "novo@x.com" });
  });

  it("falha do banco: sem sessão (falha fechada)", async () => {
    queryOne.mockRejectedValue(new Error("banco fora"));
    expect(await getSession()).toBeNull();
  });
});
