import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/modules/students/queries", () => ({
  getStudentIdByUserId: vi.fn().mockResolvedValue("student-own-id"),
}));

const sampleWork = {
  id: "work-1",
  student_id: "student-own-id",
  mission_id: "mission-1",
  mission_attempt_id: "attempt-1",
  work_type: "DOCUMENT",
  title: "Memorando",
  template_key: null,
  content: {},
  status: "DRAFT",
  version: 1,
  submitted_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/modules/student-works/queries", () => ({
  getOrCreateStudentWork: vi.fn().mockResolvedValue(sampleWork),
  listStudentWorksByStudent: vi.fn().mockResolvedValue([sampleWork]),
  listStudentWorksForStaff: vi.fn().mockResolvedValue([sampleWork]),
  getStudentWorkById: vi.fn().mockResolvedValue(sampleWork),
  saveStudentWorkContent: vi.fn().mockResolvedValue(sampleWork),
  submitStudentWork: vi.fn().mockResolvedValue({ ...sampleWork, status: "SUBMITTED" }),
  listStudentWorkVersions: vi.fn().mockResolvedValue([]),
  StudentWorkNotEditableError: class StudentWorkNotEditableError extends Error {},
}));

import { getSession } from "@/lib/auth";
const mockGetSession = vi.mocked(getSession);

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function session(overrides: Partial<SessionPayload>): SessionPayload {
  return {
    userId: "user-1",
    email: "user@teste.com",
    name: "Usuário Teste",
    role: "student",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSession.mockReset();
});

describe("POST /api/student-works — apenas aluno", () => {
  const validBody = { missionId: "550e8400-e29b-41d4-a716-446655440000", workType: "DOCUMENT" };

  it("rejeita professor com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { POST } = await import("@/app/api/student-works/route");
    const res = await POST(jsonRequest("http://localhost/api/student-works", "POST", validBody));
    expect(res.status).toBe(403);
  });

  it("rejeita usuário não autenticado com 403", async () => {
    mockGetSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/student-works/route");
    const res = await POST(jsonRequest("http://localhost/api/student-works", "POST", validBody));
    expect(res.status).toBe(403);
  });

  it("permite aluno criar seu trabalho (201)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { POST } = await import("@/app/api/student-works/route");
    const res = await POST(jsonRequest("http://localhost/api/student-works", "POST", validBody));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/student-works — listagem por perfil", () => {
  it("aluno recebe apenas os próprios trabalhos", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { GET } = await import("@/app/api/student-works/route");
    const res = await GET(jsonRequest("http://localhost/api/student-works", "GET"));
    expect(res.status).toBe(200);
  });

  it("coordenador pode listar trabalhos de qualquer aluno", async () => {
    mockGetSession.mockResolvedValue(session({ role: "coordinator" }));
    const { GET } = await import("@/app/api/student-works/route");
    const res = await GET(jsonRequest("http://localhost/api/student-works", "GET"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/student-works/[id] — isolamento entre alunos", () => {
  it("aluno dono vê o próprio trabalho (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { GET } = await import("@/app/api/student-works/[id]/route");
    const res = await GET(new Request("http://localhost/api/student-works/work-1"), {
      params: Promise.resolve({ id: "work-1" }),
    });
    expect(res.status).toBe(200);
  });

  it("aluno B não pode ver o trabalho do aluno A (403)", async () => {
    const { getStudentIdByUserId } = await import("@/modules/students/queries");
    vi.mocked(getStudentIdByUserId).mockResolvedValueOnce("student-outro-id");
    mockGetSession.mockResolvedValue(session({ role: "student", userId: "user-2" }));
    const { GET } = await import("@/app/api/student-works/[id]/route");
    const res = await GET(new Request("http://localhost/api/student-works/work-1"), {
      params: Promise.resolve({ id: "work-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("professor pode ver o trabalho de qualquer aluno (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { GET } = await import("@/app/api/student-works/[id]/route");
    const res = await GET(new Request("http://localhost/api/student-works/work-1"), {
      params: Promise.resolve({ id: "work-1" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/student-works/[id] — autosave apenas do dono", () => {
  it("rejeita professor com 403 (professor não edita trabalho do aluno)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { PATCH } = await import("@/app/api/student-works/[id]/route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/student-works/work-1", "PATCH", { content: {} }),
      { params: Promise.resolve({ id: "work-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("permite ao aluno salvar (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { PATCH } = await import("@/app/api/student-works/[id]/route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/student-works/work-1", "PATCH", { content: { a: 1 } }),
      { params: Promise.resolve({ id: "work-1" }) }
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/student-works/[id]/submit — apenas o dono entrega", () => {
  it("rejeita não autenticado com 403", async () => {
    mockGetSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/student-works/[id]/submit/route");
    const res = await POST(new Request("http://localhost/api/student-works/work-1/submit", { method: "POST" }), {
      params: Promise.resolve({ id: "work-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("permite ao aluno entregar (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { POST } = await import("@/app/api/student-works/[id]/submit/route");
    const res = await POST(new Request("http://localhost/api/student-works/work-1/submit", { method: "POST" }), {
      params: Promise.resolve({ id: "work-1" }),
    });
    expect(res.status).toBe(200);
  });
});
