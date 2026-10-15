import { listSchools } from "@/modules/schools/queries";
import { getActorSchoolId, type ScopeActor } from "@/modules/schools/scope";
import { listPeriods, type Period } from "./queries";

export interface PageContext {
  schoolId: string;
  schools: { id: string; name: string }[]; // só o admin escolhe a escola
  year: number;
  periods: Period[];
  period: Period | null;
}

export interface ContextParams { school?: string; year?: string; period?: string }

/** Escola/ano/bimestre da tela. A escola do professor/coordenador SEMPRE vem do cadastro dele, nunca da URL. */
export async function loadPageContext(actor: ScopeActor, sp: ContextParams): Promise<PageContext | null> {
  let schools: PageContext["schools"] = [];
  let schoolId: string | null;
  if (actor.role === "admin") {
    schools = (await listSchools()).map((s) => ({ id: s.id, name: s.name }));
    schoolId = schools.find((s) => s.id === sp.school)?.id ?? schools[0]?.id ?? null;
  } else {
    schoolId = await getActorSchoolId(actor);
  }
  if (!schoolId) return null;
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y >= 2020 && y <= 2100 ? y : new Date().getFullYear();
  const periods = await listPeriods(schoolId, year);
  const period = periods.find((p) => p.id === sp.period) ?? periods.find((p) => p.status === "open") ?? periods[0] ?? null;
  return { schoolId, schools, year, periods, period };
}
