import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/registry/records", async () => {
  class RecordError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return {
    RecordError,
    updateSchool: vi.fn(), setSchoolActive: vi.fn(), deleteSchool: vi.fn(),
    updateTeacher: vi.fn(), setTeacherActive: vi.fn(), deleteTeacher: vi.fn(),
    updateStudent: vi.fn(), setStudentActive: vi.fn(), deleteStudent: vi.fn(),
    updateClass: vi.fn(), setClassActive: vi.fn(), deleteClass: vi.fn(),
  };
});

import { getSession } from "@/lib/auth";
import * as R from "@/modules/registry/records";
import * as schools from "@/app/api/schools/[id]/route";
import * as teachers from "@/app/api/teachers/[id]/route";
import * as students from "@/app/api/students/[id]/route";
import * as classes from "@/app/api/classes/[id]/route";

const ID = "44444444-4444-4444-8444-444444444444";
const params = { params: Promise.resolve({ id: ID }) };
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
function as(role: SessionPayload["role"] | null) {
  vi.mocked(getSession).mockResolvedValue(role ? { userId: "u1", email: "u@x.com", name: "U", role } : null);
}

const routes = [
  { name: "escolas", mod: schools, fns: [R.updateSchool, R.setSchoolActive, R.deleteSchool], body: { name: "Escola X" } },
  { name: "professores", mod: teachers, fns: [R.updateTeacher, R.setTeacherActive, R.deleteTeacher], body: { name: "Prof", email: "p@x.com" } },
  { name: "alunos", mod: students, fns: [R.updateStudent, R.setStudentActive, R.deleteStudent], body: { name: "Aluno", email: "a@x.com", birthDate: "" } },
  { name: "turmas", mod: classes, fns: [R.updateClass, R.setClassActive, R.deleteClass], body: { name: "7A", schoolYear: 2026, shift: "", teacherId: "" } },
];

beforeEach(() => {
  for (const r of routes) for (const f of r.fns) vi.mocked(f).mockReset();
  vi.mocked(R.deleteSchool).mockResolvedValue("deleted");
  vi.mocked(R.deleteTeacher).mockResolvedValue("deactivated");
  vi.mocked(R.deleteStudent).mockResolvedValue("deleted");
  vi.mocked(R.deleteClass).mockResolvedValue("deactivated");
});

describe.each(routes)("PATCH/DELETE de $name", ({ mod, fns, body }) => {
  it.each([null, "student"] as const)("%s recebe 403 e nada é chamado", async (role) => {
    as(role);
    expect((await mod.PATCH(req("PATCH", body), params)).status).toBe(403);
    expect((await mod.DELETE(req("DELETE"), params)).status).toBe(403);
    for (const f of fns) expect(f).not.toHaveBeenCalled();
  });

  it("id inválido = 400", async () => {
    as("admin");
    const bad = { params: Promise.resolve({ id: "nao-e-uuid" }) };
    expect((await mod.PATCH(req("PATCH", body), bad)).status).toBe(400);
    expect((await mod.DELETE(req("DELETE"), bad)).status).toBe(400);
  });

  it("edição válida chama update com o ator da SESSÃO; {active} chama reativar", async () => {
    as("admin");
    expect((await mod.PATCH(req("PATCH", body), params)).status).toBe(200);
    expect(vi.mocked(fns[0]).mock.calls[0][0]).toEqual({ userId: "u1", role: "admin" });
    expect((await mod.PATCH(req("PATCH", { active: true }), params)).status).toBe(200);
    expect(vi.mocked(fns[1])).toHaveBeenCalledWith({ userId: "u1", role: "admin" }, ID, true);
  });

  it("corpo inválido = 400", async () => {
    as("admin");
    expect((await mod.PATCH(req("PATCH", { nome: "x" }), params)).status).toBe(400);
  });

  it("DELETE devolve o resultado (apagou ou desativou) e erros de regra viram o status certo", async () => {
    as("admin");
    const ok = await mod.DELETE(req("DELETE"), params);
    expect(ok.status).toBe(200);
    expect(["deleted", "deactivated"]).toContain((await ok.json()).result);
    vi.mocked(fns[2]).mockRejectedValue(new R.RecordError(403, "Sem permissão."));
    expect((await mod.DELETE(req("DELETE"), params)).status).toBe(403);
    vi.mocked(fns[2]).mockRejectedValue(new R.RecordError(404, "Cadastro não encontrado."));
    expect((await mod.DELETE(req("DELETE"), params)).status).toBe(404);
  });
});

it("e-mail duplicado na edição vira 409", async () => {
  as("admin");
  vi.mocked(R.updateStudent).mockRejectedValue(new R.RecordError(409, "Já existe um usuário com este e-mail."));
  expect((await students.PATCH(req("PATCH", { name: "Aluno", email: "a@x.com" }), params)).status).toBe(409);
});
