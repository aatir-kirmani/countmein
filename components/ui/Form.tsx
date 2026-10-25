"use client";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Label + control + hint/error, with consistent spacing. Pass the control as children with id={id}. */
export function Field({
  label, hint, error, required, optional, htmlFor, counter, children, className,
}: {
  label: string; hint?: React.ReactNode; error?: string | null; required?: boolean; optional?: boolean;
  htmlFor?: string; counter?: { value: number; max: number }; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="text-brand dark:text-violet-400" aria-hidden>*</span>}
          {optional && <span className="text-xs font-medium text-zinc-400">optional</span>}
        </label>
        {counter && (
          <span className={cn("font-mono text-[11px] tabular-nums", counter.value > counter.max * 0.9 ? "text-amber-600" : "text-zinc-400")}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {error ? <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/** A titled group of fields inside a card. Numbered sections read like a guided flow. */
export function FormSection({
  step, title, description, children, aside,
}: { step?: number | string; title: string; description?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        {step !== undefined && (
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-extrabold text-white shadow-[0_3px_0_0_#4c1d95]">
            {step}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export type Choice<T extends string> = { value: T; label: string; description?: string; icon?: string };

/** Radio group rendered as tappable cards. Best for 2 to 4 options that need a sentence each. */
export function ChoiceCards<T extends string>({
  label, options, value, onChange, columns = 3,
}: { label: string; options: Choice<T>[]; value: T; onChange: (v: T) => void; columns?: 2 | 3 | 4 }) {
  const name = useId();
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className={cn("grid gap-2.5", cols)}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-2xl p-4 ring-1 ring-inset transition",
                on
                  ? "bg-violet-50 ring-2 ring-brand dark:bg-violet-950/40 dark:ring-violet-400"
                  : "bg-zinc-50 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-800/40 dark:ring-zinc-700/70 dark:hover:ring-zinc-600"
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <span className="flex items-center gap-2 font-bold">
                {o.icon && <span aria-hidden className="text-lg">{o.icon}</span>}
                {o.label}
              </span>
              {o.description && <span className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">{o.description}</span>}
              <span
                aria-hidden
                className={cn(
                  "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black transition",
                  on ? "bg-brand text-white" : "ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700"
                )}
              >
                {on ? "✓" : ""}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Compact pill switcher for short options (stage, filters). */
export function Segmented<T extends string>({
  label, options, value, onChange, hideLabel,
}: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; hideLabel?: boolean }) {
  const name = useId();
  return (
    <fieldset>
      <legend className={hideLabel ? "sr-only" : "label"}>{label}</legend>
      <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800/70">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex min-h-[40px] flex-1 cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-bold transition",
                on ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Number input with big minus/plus buttons. Empty string means "not set". */
export function Stepper({
  id, value, onChange, min = 0, max = 100000, step = 1, placeholder, prefix, suffix,
}: {
  id?: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number;
  placeholder?: string; prefix?: string; suffix?: string;
}) {
  const n = value === "" ? null : Number(value);
  const bump = (d: number) => {
    const next = Math.min(max, Math.max(min, (n ?? (d > 0 ? min - step : min)) + d));
    onChange(String(Number(next.toFixed(2))));
  };
  const btn = "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-xl font-bold text-zinc-700 transition hover:bg-zinc-200 active:scale-95 disabled:opacity-40 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => bump(-step)} disabled={n === null || n <= min} aria-label="Decrease">−</button>
      <div className="relative flex-1">
        {prefix && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-zinc-500">{prefix}</span>}
        <input
          id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn("input text-center font-semibold tabular-nums", prefix && "pl-9", suffix && "pr-14")}
        />
        {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">{suffix}</span>}
      </div>
      <button type="button" className={btn} onClick={() => bump(step)} disabled={n !== null && n >= max} aria-label="Increase">+</button>
    </div>
  );
}

/** Accessible on/off switch with a label and optional description. */
export function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800/40 dark:ring-zinc-700/70">
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">{description}</span>}
      </span>
      <button
        id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-zinc-300 dark:bg-zinc-700")}
      >
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
      </button>
    </label>
  );
}

/** Bottom action bar that sticks above the mobile nav while the form scrolls. */
export function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-16 z-30 -mx-4 mt-6 border-t border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur sm:bottom-0 sm:mx-0 sm:rounded-3xl sm:border sm:px-4 dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

/** Page header used at the top of forms and dashboards. */
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">{description}</p>}
      </div>
      {action}
    </header>
  );
}
