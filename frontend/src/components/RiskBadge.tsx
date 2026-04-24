type RiskLevel = "low" | "medium" | "high" | null | undefined;

export function riskBadgeClass(level: RiskLevel): string {
  if (level === "low") return "badge-low";
  if (level === "medium") return "badge-medium";
  if (level === "high") return "badge-high";
  return "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-widest text-slate-400";
}

export function riskTextClass(level: RiskLevel): string {
  if (level === "low") return "text-emerald-300";
  if (level === "medium") return "text-amber-300";
  if (level === "high") return "text-rose-300";
  return "text-slate-400";
}

export function riskDotClass(level: RiskLevel): string {
  if (level === "low") return "bg-emerald-400";
  if (level === "medium") return "bg-amber-400";
  if (level === "high") return "bg-rose-400";
  return "bg-slate-500";
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={riskBadgeClass(level)}>{level ?? "pending"}</span>;
}
