import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError, NO_SCHOOL } from "@/modules/council/http";
import { createCriterion, listCriteria, resolveSchoolId } from "@/modules/council/queries";

export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  try {
    const schoolId = await resolveSchoolId(auth.actor, request.nextUrl.searchParams.get("schoolId"));
    if (!schoolId) return NO_SCHOOL();
    const all = request.nextUrl.searchParams.get("all") === "1" && auth.actor.role !== "teacher";
    return NextResponse.json({ criteria: await listCriteria(schoolId, all) });
  } catch (e) { return mapError(e); }
}

const schema = z.object({
  schoolId: z.string().uuid().optional(),
  label: z.string().min(3).max(200),
  kind: z.enum(["yesno", "text"]),
  required: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  try {
    const schoolId = await resolveSchoolId(auth.actor, parsed.data.schoolId);
    if (!schoolId) return NO_SCHOOL();
    const criterion = await createCriterion(auth.actor, schoolId, parsed.data);
    return NextResponse.json({ criterion }, { status: 201 });
  } catch (e) { return mapError(e); }
}
