import { stageLabel } from "@/lib/utils";

const STAGE: Record<string, { cls: string; icon: string }> = {
  idea: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200", icon: "💡" },
  building: { cls: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200", icon: "🛠️" },
  launched: { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200", icon: "🚀" },
  revenue: { cls: "bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200", icon: "💸" },
};

export function StageBadge({ stage }: { stage: string }) {
  const s = STAGE[stage];
  return (
    <span className={`chip ${s?.cls ?? "bg-zinc-100 dark:bg-zinc-800"}`}>
      {s && <span aria-hidden className="text-[11px] leading-none">{s.icon}</span>}
      {stageLabel(stage)}
    </span>
  );
}

const STATUS: Record<string, { cls: string; dot: string; label: string }> = {
  pending: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200", dot: "bg-amber-500", label: "Pending" },
  interested: { cls: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200", dot: "bg-sky-500", label: "Let's talk" },
  accepted: { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200", dot: "bg-emerald-500", label: "Matched" },
  declined: { cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", dot: "bg-zinc-400", label: "Declined" },
  withdrawn: { cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", dot: "bg-zinc-400", label: "Withdrawn" },
  expired: { cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", dot: "bg-zinc-400", label: "Expired" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { cls: "bg-zinc-100 dark:bg-zinc-800", dot: "bg-zinc-400", label: status };
  return (
    <span className={`chip ${s.cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === "pending" ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}
