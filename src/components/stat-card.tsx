import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
          <Icon size={20} />
        </div>
        <span className="badge badge-live">Live</span>
      </div>
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-[var(--primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p>
    </div>
  );
}
