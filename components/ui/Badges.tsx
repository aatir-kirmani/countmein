import { stageLabel } from "@/lib/utils";

const STAGE_COLORS: Record<string, string> = {
  idea: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  building: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  launched: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  revenue: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
};

export function StageBadge({ stage }: { stage: string }) {
  return <span className={`chip ${STAGE_COLORS[stage] ?? ""}`}>{stageLabel(stage)}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    interested: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    accepted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    declined: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    withdrawn: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    expired: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  };
  const label = status === "interested" ? "Let's talk" : status[0].toUpperCase() + status.slice(1);
  return <span className={`chip ${c[status] ?? ""}`}>{label}</span>;
}
