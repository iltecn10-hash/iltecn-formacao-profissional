import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

const listStudents = vi.fn().mockResolvedValue([]);
const listTeachers = vi.fn().mockResolvedValue([]);
const listClasses = vi.fn().mockResolvedValue([]);
const createClass = vi.fn().mockResolvedValue({ id: "class-1" });
const createStudent = vi.fn().mockResolvedValue({ id: "student-1" });
const teacherBelongsToSchool = vi.fn().mockResolvedValue(true);
const canActorUseSchool = vi.fn().mockResolvedValue(true);

vi.mock("@/modules/students/queries", () => ({
  listStudents: (...a: unknown[]) => listStudents(...a),
  createStudent: (...a: unknown[]) => createStudent(...a),
}));
vi.mock("@/modules/teachers/queries", () => ({
  listTeachers: (...a: unknown[]) => listTeachers(...a),
  createTeacher: vi.fn(),
}));
vi.mock("@/modules/classes/queries", () => ({
  listClasses: (...a: unknown[]) => listClasses(...a),
  createClass: (...a: unknown[]) => createClass(...a),
  teacherBelongsToSchool: (...a: unknown[]) => teacherBelongsToSchool(...a),
}));
vi.mock("@/modules/schools/scope", () => ({
  canActorUseSchool: (...a: unknown[]) => canActorUseSchool(...a),
}));

import { getSession } from "@/lib/auth";
const mockGetSession = vi.mocked(getSession);

const SCHOOL = "550e8400-e29b-41d4-a716-446655440000";
const TEACHER = "660e8400-e29b-41d4-a716-446655440000";

function session(role: SessionPayload["role"]): SessionPayload {
  return { userId: "user-1", email: "u@x.com", name: "U", role };
}
function post(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetSession.mockReset();
  listStudents.mockClear();
  listTeachers.mockClear();
  listClasses.mockClear();
  createClass.mockClear();
  createStudent.mockClear();
  canActorUseSchool.mockReset().mockResolvedValue(true);
  teacherBelongsToSchool.mockReset().mockResolvedValue(true);
});

describe.each([
  ["students", "@/app/api/students/route", () => listStudents],
  ["teachers", "@/app/api/teachers/route", () => listTeachers],
  ["classes", "@/app/api/classes/route", () => listClasses],
])("GET /api/%s — listagem com escopo", (_name, path, fn) => {
  it("sem sessão: 401", async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import(/* @vite-ignore */ path);
    expect((await GET()).status).toBe(401);
    expect(fn()).not.toHaveBeenCalled();
  });

  it("aluno: 403 e a consulta nem é executada", async () => {
    mockGetSession.mockResolvedValue(session("student"));
    const { GET } = await import(/* @vite-ignore */ path);
    expect((await GET()).status).toBe(403);
    expect(fn()).not.toHaveBeenCalled();
  });

  it.each(["admin", "teacher", "coordinator"] as const)(
    "%s: 200 e a consulta recebe o ator da SESSÃO",
    async (role) => {
      mockGetSession.mockResolvedValue(session(role));
      const { GET } = await import(/* @vite-ignore */ path);
      expect((await GET()).status).toBe(200);
      expect(fn()).toHaveBeenCalledWith({ userId: "user-1", role });
    }
  );
});

describe("POST /api/classes — escola validada no servidor", () => {
  const body = { name: "6º A", schoolId: SCHOOL, schoolYear: 2026 };

  it("professor numa escola que não é a dele: 403 e nada é criado", async () => {
    mockGetSession.mockResolvedValue(session("teacher"));
    canActorUseSchool.mockResolvedValue(false);
    const { POST } = await import("@/app/api/classes/route");
    expect((await POST(post("http://localhost/api/classes", body))).status).toBe(403);
    expect(createClass).not.toHaveBeenCalled();
  });

  it("professor indicado de outra escola: 400 e nada é criado", async () => {
    mockGetSession.mockResolvedValue(session("admin"));
    teacherBelongsToSchool.mockResolvedValue(false);
    const { POST } = await import("@/app/api/classes/route");
    const res = await POST(post("http://localhost/api/classes", { ...body, teacherId: TEACHER }));
    expect(res.status).toBe(400);
    expect(createClass).not.toHaveBeenCalled();
  });

  it("professor na própria escola: 201", async () => {
    mockGetSession.mockResolvedValue(session("teacher"));
    const { POST } = await import("@/app/api/classes/route");
    expect((await POST(post("http://localhost/api/classes", body))).status).toBe(201);
    expect(createClass).toHaveBeenCalledOnce();
  });
});

describe("POST /api/students — professor só cadastra na própria escola", () => {
  const body = { name: "Aluno Teste", email: "a@x.com", password: "senha123", schoolId: SCHOOL };

  it("escola de outro: 403 e nada é criado", async () => {
    mockGetSession.mockResolvedValue(session("teacher"));
    canActorUseSchool.mockResolvedValue(false);
    const { POST } = await import("@/app/api/students/route");
    expect((await POST(post("http://localhost/api/students", body))).status).toBe(403);
    expect(createStudent).not.toHaveBeenCalled();
  });
});
