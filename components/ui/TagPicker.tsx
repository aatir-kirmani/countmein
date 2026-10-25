"use client";
import { useState } from "react";

/** Multi-select chips with a custom-entry field. */
export function TagPicker({
  options, value, onChange, allowCustom = true, label, hint, size = "md",
}: {
  options: readonly string[]; value: string[]; onChange: (v: string[]) => void; allowCustom?: boolean;
  label?: string; hint?: string; size?: "md" | "lg";
}) {
  const [custom, setCustom] = useState("");
  const all = Array.from(new Set([...options, ...value]));
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const add = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom("");
  };
  const chip = size === "lg" ? "min-h-[46px] px-4 text-[15px]" : "min-h-[40px] px-3.5 text-sm";
  return (
    <fieldset>
      {label && (
        <legend className="label w-full justify-between">
          <span>{label}</span>
          {value.length > 0 && <span className="font-mono text-[11px] font-bold text-brand dark:text-violet-400">{value.length} picked</span>}
        </legend>
      )}
      {hint && <p className="-mt-0.5 mb-2.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {all.map((t) => {
          const on = value.includes(t);
          return (
            <button
              type="button" key={t} onClick={() => toggle(t)} aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all duration-150 active:scale-95 ${chip} ${
                on
                  ? "bg-brand text-white shadow-[0_3px_0_0_#4c1d95] -translate-y-px"
                  : "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:ring-zinc-700"
              }`}
            >
              {on && <span aria-hidden className="text-lime-300">✓</span>}
              {t}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="relative mt-3">
          <input
            className="input pr-24" placeholder="Something else? Type it here" value={custom}
            onChange={(e) => setCustom(e.target.value)} maxLength={30}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label={`Add your own ${label?.toLowerCase() ?? "tag"}`}
          />
          <button type="button" onClick={add} disabled={!custom.trim()}
            className="absolute right-1.5 top-1.5 h-9 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white transition disabled:opacity-30 dark:bg-white dark:text-zinc-900">
            Add
          </button>
        </div>
      )}
    </fieldset>
  );
}
