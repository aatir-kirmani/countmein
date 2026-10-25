import { cn } from "@/lib/utils";
import type { Guest } from "./core";

const ICONS: Record<string, string> = {
  board: "M3 5h18v12H3zM8 21h8M12 17v4",
  poster: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h3",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2",
  csv: "M12 3v12M7 10l5 5 5-5M5 21h14",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10",
  copy: "M8 8h12v12H8zM4 16V4h12",
  check: "m5 12 5 5L20 7",
  x: "M6 6l12 12M18 6 6 18",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  home: "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5",
  chevron: "m6 9 6 6 6-6",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
};

export function HIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  checked_in: { label: "Checked in", cls: "bg-lime-300 text-zinc-900" },
  going: { label: "Going", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200" },
  waitlist: { label: "Waitlist", cls: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200" },
  declined: { label: "Declined", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

export function GuestStatusChip({ guest, className }: { guest: Pick<Guest, "status" | "checked_in_at">; className?: string }) {
  const key = guest.checked_in_at ? "checked_in" : guest.status;
  const s = STATUS[key] ?? STATUS.going;
  return (
    <span className={cn("chip shrink-0", s.cls, className)}>
      {key === "checked_in" && <HIcon name="check" className="h-3 w-3" />}
      {s.label}
    </span>
  );
}

/** Small stat tile used on Overview and Insights. */
export function StatTile({ label, value, sub, tone = "default", onClick }: { label: string; value: React.ReactNode; sub?: string; tone?: "default" | "lime" | "amber" | "sky" | "brand"; onClick?: () => void }) {
  const tones = {
    default: "bg-white ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800",
    lime: "bg-lime-100 ring-lime-200 dark:bg-lime-950/40 dark:ring-lime-900",
    amber: "bg-amber-50 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900/60",
    sky: "bg-sky-50 ring-sky-200 dark:bg-sky-950/30 dark:ring-sky-900/60",
    brand: "bg-violet-50 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-900/60",
  };
  const body = (
    <>
      <p className="font-display text-3xl font-extrabold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">{label}</p>
      {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
    </>
  );
  const cls = cn("rounded-3xl p-4 text-left ring-1 ring-inset", tones[tone], onClick && "transition hover:-translate-y-0.5");
  return onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}
