export function ProgressBar({
  label,
  percent,
}: {
  label: string;
  percent: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-4">
      <span className="w-28 shrink-0 text-sm text-foreground">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-medium text-muted">
        {clamped}%
      </span>
    </div>
  );
}
