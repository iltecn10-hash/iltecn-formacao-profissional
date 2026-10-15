import { NextRequest, NextResponse } from "next/server";
import { requireStaff, mapError, NO_SCHOOL } from "@/modules/council/http";
import { listPeriods, resolveSchoolId } from "@/modules/council/queries";

export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  try {
    const schoolId = await resolveSchoolId(auth.actor, request.nextUrl.searchParams.get("schoolId"));
    if (!schoolId) return NO_SCHOOL();
    const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2020 || year > 2100)
      return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
    return NextResponse.json({ periods: await listPeriods(schoolId, year) });
  } catch (e) { return mapError(e); }
}
