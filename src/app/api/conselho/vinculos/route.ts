import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { createAssignment, listAssignments } from "@/modules/council/queries";

export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  try {
    const schoolId = auth.actor.role === "admin" ? request.nextUrl.searchParams.get("schoolId") : null;
    return NextResponse.json({ assignments: await listAssignments(auth.actor, schoolId) });
  } catch (e) { return mapError(e); }
}

const schema = z.object({
  classId: z.string().uuid(), subjectId: z.string().uuid(), teacherId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ assignment: await createAssignment(auth.actor, parsed.data) }, { status: 201 });
  } catch (e) { return mapError(e); }
}
