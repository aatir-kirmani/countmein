"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Field } from "@/components/ui/Form";

type Series = { id: string; name: string; slug: string; description: string | null; city: string | null; cover_url: string | null };

/** Inline editor for a recurring series' community page. */
export function SeriesEditor({ series, userId }: { series: Series; userId: string }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(series);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("event_series")
      .update({ name: f.name.trim(), description: f.description?.trim() || null, city: f.city?.trim() || null, cover_url: f.cover_url })
      .eq("id", series.id);
    setBusy(false);
    if (error) toast(error.message, { kind: "error" });
    else { toast("Series updated", { kind: "success" }); setOpen(false); }
  };

  return (
    <li className="card overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {f.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.cover_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-lime-300 font-display text-lg font-extrabold text-white">{f.name[0]}</span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/series/${series.slug}`} className="block truncate font-bold hover:text-brand">{f.name}</Link>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{f.city || "No city yet"} · /series/{series.slug}</p>
        </div>
        <button className="btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Edit"}</button>
      </div>
      {open && (
        <form onSubmit={save} className="space-y-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Series name" htmlFor={`s-name-${series.id}`} required>
              <input id={`s-name-${series.id}`} className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="City" htmlFor={`s-city-${series.id}`} optional>
              <input id={`s-city-${series.id}`} className="input" placeholder="Dubai" value={f.city ?? ""} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </Field>
          </div>
          <Field label="About this community" htmlFor={`s-desc-${series.id}`} optional counter={{ value: (f.description ?? "").length, max: 500 }}>
            <textarea id={`s-desc-${series.id}`} className="input" rows={3} maxLength={500} placeholder="Monthly meetup for people shipping side projects in Dubai." value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <ImageUpload label="Cover image" userId={userId} value={f.cover_url} onChange={(url) => setF({ ...f, cover_url: url })} />
          <button className="btn-primary w-full" disabled={busy || !f.name.trim()}>{busy ? "Saving…" : "Save series"}</button>
        </form>
      )}
    </li>
  );
}
