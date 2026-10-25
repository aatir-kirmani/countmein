"use client";
import { useState } from "react";

/** Multi-select chips with a custom-entry field. */
export function TagPicker({
  options, value, onChange, allowCustom = true, label,
}: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; allowCustom?: boolean; label?: string }) {
  const [custom, setCustom] = useState("");
  const all = Array.from(new Set([...options, ...value]));
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const add = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom("");
  };
  return (
    <fieldset>
      {label && <legend className="label">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {all.map((t) => {
          const on = value.includes(t);
          return (
            <button
              type="button" key={t} onClick={() => toggle(t)} aria-pressed={on}
              className={`min-h-[40px] rounded-full px-3.5 text-sm font-medium ring-1 transition ${on ? "bg-brand text-white ring-brand" : "bg-white ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700"}`}
            >
              {t}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="mt-2 flex gap-2">
          <input className="input" placeholder="Add your own" value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label="Custom tag" />
          <button type="button" className="btn-secondary" onClick={add}>Add</button>
        </div>
      )}
    </fieldset>
  );
}
