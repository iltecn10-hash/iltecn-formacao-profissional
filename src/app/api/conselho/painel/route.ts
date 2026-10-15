import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError, NO_SCHOOL } from "@/modules/council/http";
import { resolveSchoolId } from "@/modules/council/queries";
import { getPanel } from "@/modules/council/evaluations";

export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const periodId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("periodId"));
  if (!periodId.success) return NextResponse.json({ error: "Bimestre inválido." }, { status: 400 });
  try {
    const schoolId = await resolveSchoolId(auth.actor, request.nextUrl.searchParams.get("schoolId"));
    if (!schoolId) return NO_SCHOOL();
    const panel = await getPanel(auth.actor, schoolId, periodId.data);
    if (!panel) return NextResponse.json({ error: "Bimestre não encontrado." }, { status: 404 });
    return NextResponse.json({ panel });
  } catch (e) { return mapError(e); }
}
