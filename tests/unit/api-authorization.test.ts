import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/modules/schools/queries", () => ({
  listSchools: vi.fn().mockResolvedValue([]),
  createSchool: vi.fn().mockResolvedValue({ id: "school-1", name: "Escola X" }),
}));

vi.mock("@/modules/teachers/queries", () => ({
  listTeachers: vi.fn().mockResolvedValue([]),
  createTeacher: vi.fn().mockResolvedValue({ id: "teacher-1" }),
}));

vi.mock("@/modules/students/queries", () => ({
  listStudents: vi.fn().mockResolvedValue([]),
  createStudent: vi.fn().mockResolvedValue({ id: "student-1" }),
  getStudentIdByUserId: vi.fn().mockResolvedValue("student-own-id"),
}));

vi.mock("@/modules/missions/queries", () => ({
  listMissionsByModule: vi.fn().mockResolvedValue([]),
  createMission: vi.fn().mockResolvedValue({ id: "mission-1" }),
  completeMissionAttempt: vi.fn().mockResolvedValue(undefined),
  getMissionTaskById: vi.fn().mockResolvedValue({
    id: "task-1",
    mission_id: "mission-1",
    description: "Etapa 1",
    sort_order: 1,
  }),
  upsertMissionTaskVideo: vi.fn().mockResolvedValue({ id: "video-1" }),
  deleteMissionTaskVideo: vi.fn().mockResolvedValue(undefined),
  getMissionById: vi.fn().mockResolvedValue({ id: "mission-1", title: "Missão 1" }),
  upsertMissionVideo: vi.fn().mockResolvedValue({ id: "mission-video-1" }),
  deleteMissionVideo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/reports/queries", () => ({
  getStudentReport: vi.fn().mockResolvedValue({
    student: { id: "student-own-id", name: "Aluno", email: "a@a.com" },
  }),
}));

import { getSession } from "@/lib/auth";
const mockGetSession = vi.mocked(getSession);

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

describe("POST /api/schools — apenas admin", () => {
  it("rejeita professor com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { POST } = await import("@/app/api/schools/route");
    const res = await POST(jsonRequest("http://localhost/api/schools", { name: "Escola X" }));
    expect(res.status).toBe(403);
  });

  it("rejeita aluno com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { POST } = await import("@/app/api/schools/route");
    const res = await POST(jsonRequest("http://localhost/api/schools", { name: "Escola X" }));
    expect(res.status).toBe(403);
  });

  it("rejeita usuário não autenticado com 403 (sessão nula)", async () => {
    mockGetSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/schools/route");
    const res = await POST(jsonRequest("http://localhost/api/schools", { name: "Escola X" }));
    expect(res.status).toBe(403);
  });

  it("permite admin criar escola (201)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "admin" }));
    const { POST } = await import("@/app/api/schools/route");
    const res = await POST(jsonRequest("http://localhost/api/schools", { name: "Escola X" }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/students — admin ou professor", () => {
  const validBody = {
    name: "Aluno Teste",
    email: "aluno@teste.com",
    password: "senha123",
    schoolId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("rejeita coordenador com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "coordinator" }));
    const { POST } = await import("@/app/api/students/route");
    const res = await POST(jsonRequest("http://localhost/api/students", validBody));
    expect(res.status).toBe(403);
  });

  it("permite professor cadastrar aluno (201)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { POST } = await import("@/app/api/students/route");
    const res = await POST(jsonRequest("http://localhost/api/students", validBody));
    expect(res.status).toBe(201);
  });

  it("permite admin cadastrar aluno (201)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "admin" }));
    const { POST } = await import("@/app/api/students/route");
    const res = await POST(jsonRequest("http://localhost/api/students", validBody));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/missions — apenas admin", () => {
  const validBody = {
    moduleId: "550e8400-e29b-41d4-a716-446655440000",
    title: "Missão de Teste",
  };

  it("rejeita professor com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { POST } = await import("@/app/api/missions/route");
    const res = await POST(jsonRequest("http://localhost/api/missions", validBody));
    expect(res.status).toBe(403);
  });

  it("permite admin criar missão (201)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "admin" }));
    const { POST } = await import("@/app/api/missions/route");
    const res = await POST(jsonRequest("http://localhost/api/missions", validBody));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/missions/complete — apenas aluno", () => {
  const validBody = { missionId: "550e8400-e29b-41d4-a716-446655440000" };

  it("rejeita professor com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { POST } = await import("@/app/api/missions/complete/route");
    const res = await POST(jsonRequest("http://localhost/api/missions/complete", validBody));
    expect(res.status).toBe(403);
  });

  it("rejeita admin com 403 (admin não é aluno)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "admin" }));
    const { POST } = await import("@/app/api/missions/complete/route");
    const res = await POST(jsonRequest("http://localhost/api/missions/complete", validBody));
    expect(res.status).toBe(403);
  });

  it("permite aluno concluir sua própria missão (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student", userId: "user-1" }));
    const { POST } = await import("@/app/api/missions/complete/route");
    const res = await POST(jsonRequest("http://localhost/api/missions/complete", validBody));
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/missions/[id]/tasks/[taskId]/video — apenas equipe (Fase 10.1)", () => {
  const validBody = {
    title: "Como organizar os dados",
    videoUrl: "https://youtube.com/watch?v=abc123",
  };
  const routeParams = { params: Promise.resolve({ id: "mission-1", taskId: "task-1" }) };

  it("rejeita aluno com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { PUT } = await import("@/app/api/missions/[id]/tasks/[taskId]/video/route");
    const res = await PUT(
      jsonRequest("http://localhost/api/missions/mission-1/tasks/task-1/video", validBody),
      routeParams
    );
    expect(res.status).toBe(403);
  });

  it("permite professor associar um vídeo (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { PUT } = await import("@/app/api/missions/[id]/tasks/[taskId]/video/route");
    const res = await PUT(
      jsonRequest("http://localhost/api/missions/mission-1/tasks/task-1/video", validBody),
      routeParams
    );
    expect(res.status).toBe(200);
  });

  it("rejeita quando a etapa não pertence à missão da URL (404)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "admin" }));
    const { PUT } = await import("@/app/api/missions/[id]/tasks/[taskId]/video/route");
    const res = await PUT(
      jsonRequest("http://localhost/api/missions/outra-missao/tasks/task-1/video", validBody),
      { params: Promise.resolve({ id: "outra-missao", taskId: "task-1" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/missions/[id]/tasks/[taskId]/video — apenas equipe (Fase 10.1)", () => {
  it("permite coordenador remover um vídeo (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "coordinator" }));
    const { DELETE } = await import("@/app/api/missions/[id]/tasks/[taskId]/video/route");
    const res = await DELETE(new Request("http://localhost/api/missions/mission-1/tasks/task-1/video"), {
      params: Promise.resolve({ id: "mission-1", taskId: "task-1" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejeita aluno com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { DELETE } = await import("@/app/api/missions/[id]/tasks/[taskId]/video/route");
    const res = await DELETE(new Request("http://localhost/api/missions/mission-1/tasks/task-1/video"), {
      params: Promise.resolve({ id: "mission-1", taskId: "task-1" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/missions/[id]/video — apenas equipe (Fase 10.5)", () => {
  const validBody = {
    title: "Como preencher o requerimento de férias",
    videoUrl: "https://iltecn-formacao-profissional.vercel.app/videos/requerimento-ferias/explicativo.mp4",
  };
  const routeParams = { params: Promise.resolve({ id: "mission-1" }) };

  it("rejeita aluno com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { PUT } = await import("@/app/api/missions/[id]/video/route");
    const res = await PUT(jsonRequest("http://localhost/api/missions/mission-1/video", validBody), routeParams);
    expect(res.status).toBe(403);
  });

  it("permite professor associar o vídeo da missão (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { PUT } = await import("@/app/api/missions/[id]/video/route");
    const res = await PUT(jsonRequest("http://localhost/api/missions/mission-1/video", validBody), routeParams);
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/missions/[id]/video — apenas equipe (Fase 10.5)", () => {
  it("permite admin remover o vídeo da missão (200)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "admin" }));
    const { DELETE } = await import("@/app/api/missions/[id]/video/route");
    const res = await DELETE(new Request("http://localhost/api/missions/mission-1/video"), {
      params: Promise.resolve({ id: "mission-1" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejeita aluno com 403", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student" }));
    const { DELETE } = await import("@/app/api/missions/[id]/video/route");
    const res = await DELETE(new Request("http://localhost/api/missions/mission-1/video"), {
      params: Promise.resolve({ id: "mission-1" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/reports/student/[id] — privacidade do relatório do aluno", () => {
  it("aluno pode ver o próprio relatório", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student", userId: "user-1" }));
    const { GET } = await import("@/app/api/reports/student/[id]/route");
    const res = await GET(new Request("http://localhost/api/reports/student/student-own-id"), {
      params: Promise.resolve({ id: "student-own-id" }),
    });
    expect(res.status).toBe(200);
  });

  it("aluno NÃO pode ver o relatório de outro aluno (403)", async () => {
    mockGetSession.mockResolvedValue(session({ role: "student", userId: "user-1" }));
    const { GET } = await import("@/app/api/reports/student/[id]/route");
    const res = await GET(new Request("http://localhost/api/reports/student/outro-aluno"), {
      params: Promise.resolve({ id: "outro-aluno-id" }),
    });
    expect(res.status).toBe(403);
  });

  it("professor pode ver o relatório de qualquer aluno", async () => {
    mockGetSession.mockResolvedValue(session({ role: "teacher" }));
    const { GET } = await import("@/app/api/reports/student/[id]/route");
    const res = await GET(new Request("http://localhost/api/reports/student/qualquer-aluno"), {
      params: Promise.resolve({ id: "qualquer-aluno-id" }),
    });
    expect(res.status).toBe(200);
  });
});
