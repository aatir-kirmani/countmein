"use client";
import { cn } from "@/lib/utils";

/** Empty state with an emoji mascot, a headline and a next step. */
export function EmptyState({ emoji, title, body, action, className }: { emoji: string; title: string; body?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl border-2 border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-800", className)}>
      <span aria-hidden className="mx-auto flex h-16 w-16 rotate-[-6deg] items-center justify-center rounded-2xl bg-lime-200 text-3xl shadow-[0_4px_0_0_#a3e635] dark:bg-lime-300">{emoji}</span>
      <p className="mt-4 font-display text-xl font-extrabold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Pill tab bar with optional counts. Sticky placement is up to the caller. */
export function TabBar<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: string; count?: number | null; dot?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-900">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value} role="tab" aria-selected={on} onClick={() => onChange(t.value)}
            className={cn(
              "relative flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold transition",
              on ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            {t.label}
            {t.count != null && (
              <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums", on ? "bg-brand text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>{t.count}</span>
            )}
            {t.dot && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle chip used in filter bars. */
export function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-pressed={on} onClick={onClick}
      className={cn(
        "flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition",
        on ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900 dark:ring-white" : "bg-white text-zinc-700 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"
      )}
    >
      {children}
    </button>
  );
}

/** A select styled as a filter chip. */
export function ChipSelect({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <span className="relative shrink-0">
      <select
        value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className={cn(
          "min-h-[38px] cursor-pointer appearance-none rounded-full py-0 pl-3.5 pr-8 text-sm font-semibold ring-1 ring-inset transition focus:outline-none focus:ring-2 focus:ring-brand",
          value ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900 dark:ring-white" : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"
        )}
      >
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 24 24" className={cn("pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2", value ? "text-white dark:text-zinc-900" : "text-zinc-500")} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
    </span>
  );
}

/** Small uppercase heading for sections inside a page. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-display text-lg font-extrabold">{children}</h2>
      {action}
    </div>
  );
}

/** Deterministic pastel for a string (logo fallbacks, avatars without photos). */
export function hueFor(s: string) {
  const palette = [
    "bg-amber-200 text-amber-900", "bg-sky-200 text-sky-900", "bg-emerald-200 text-emerald-900", "bg-rose-200 text-rose-900",
    "bg-violet-200 text-violet-900", "bg-lime-200 text-lime-900", "bg-orange-200 text-orange-900", "bg-cyan-200 text-cyan-900",
  ];
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Project logo with a playful letter fallback. */
export function ProjectLogo({ name, url, size = 48, className }: { name: string; url: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={style} className={cn("shrink-0 rounded-2xl object-cover ring-1 ring-black/5", className)} />;
  }
  return (
    <span aria-hidden style={{ ...style, fontSize: size * 0.42 }} className={cn("flex shrink-0 items-center justify-center rounded-2xl font-display font-extrabold", hueFor(name), className)}>
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** Tiny inline icons (stroke, currentColor). */
const ICONS = {
  calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  search: "m20 20-4.5-4.5M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 18l-6-6 6-6",
  ticket: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Zm9 0v10",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  phone: "M6.6 3h2.8l1.4 4.2-2 1.3a12 12 0 0 0 6.7 6.7l1.3-2 4.2 1.4v2.8A2.6 2.6 0 0 1 18.4 20 15.4 15.4 0 0 1 4 5.6 2.6 2.6 0 0 1 6.6 3Z",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "m5 12 4.5 4.5L19 7",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
} as const;
export type IconName = keyof typeof ICONS;
export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}
