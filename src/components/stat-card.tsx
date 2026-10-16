import Link from "next/link";

/** Indicador do painel: título, valor legível e, quando útil, uma descrição curta. */
export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "info",
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: "info" | "success" | "warning";
}) {
  const bar = { info: "bg-primary", success: "bg-success", warning: "bg-warning" }[tone];
  const body = (
    <div className="card relative overflow-hidden px-5 py-4 transition hover:shadow-md">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 font-heading text-3xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}
