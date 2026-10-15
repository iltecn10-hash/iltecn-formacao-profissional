import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, mapError } from "@/modules/council/http";
import { getClassReport, classReportToCsv } from "@/modules/council/evaluations";

export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const p = request.nextUrl.searchParams;
  const classId = z.string().uuid().safeParse(p.get("classId"));
  const periodId = z.string().uuid().safeParse(p.get("periodId"));
  if (!classId.success || !periodId.success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    const report = await getClassReport(auth.actor, classId.data, periodId.data);
    if (!report) return NextResponse.json({ error: "Turma ou bimestre não encontrado." }, { status: 404 });
    if (p.get("format") === "csv")
      return new NextResponse(classReportToCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="conselho-de-classe.csv"',
          "Cache-Control": "no-store",
        },
      });
    return NextResponse.json({ report });
  } catch (e) { return mapError(e); }
}
