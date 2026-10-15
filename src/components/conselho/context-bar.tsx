import type { PageContext } from "@/modules/council/context";

const sel =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Filtro por GET (funciona sem JavaScript): escola (admin), ano e bimestre. */
export function ContextBar({ ctx, extra }: { ctx: PageContext; extra?: Record<string, string> }) {
  return (
    <form method="get" className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {ctx.schools.length > 0 && (
        <label className="text-xs font-medium text-muted">
          Escola
          <select name="school" defaultValue={ctx.schoolId} className={`${sel} mt-1 block`}>
            {ctx.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-xs font-medium text-muted">
        Ano letivo
        <input name="year" type="number" min={2020} max={2100} defaultValue={ctx.year} className={`${sel} mt-1 block w-24`} />
      </label>
      <label className="text-xs font-medium text-muted">
        Bimestre
        <select name="period" defaultValue={ctx.period?.id} className={`${sel} mt-1 block`}>
          {ctx.periods.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.status === "closed" ? " (encerrado)" : ""}</option>
          ))}
        </select>
      </label>
      <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">Ver</button>
    </form>
  );
}

export function ctxQuery(ctx: PageContext): string {
  const p = new URLSearchParams({ year: String(ctx.year) });
  if (ctx.period) p.set("period", ctx.period.id);
  if (ctx.schools.length) p.set("school", ctx.schoolId);
  return p.toString();
}
