"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { ImageUpload } from "@/components/ui/ImageUpload";

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
    else { toast("Series updated"); setOpen(false); }
  };

  return (
    <li className="card p-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/series/${series.slug}`} className="font-medium hover:underline">{f.name}</Link>
        <button className="btn-ghost text-sm" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Edit"}</button>
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 space-y-3">
          <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Series name" />
          <input className="input" placeholder="City" value={f.city ?? ""} onChange={(e) => setF({ ...f, city: e.target.value })} aria-label="City" />
          <textarea className="input" rows={3} placeholder="What is this community about?" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Description" />
          <ImageUpload label="Cover image" userId={userId} value={f.cover_url} onChange={(url) => setF({ ...f, cover_url: url })} />
          <button className="btn-primary w-full" disabled={busy || !f.name.trim()}>{busy ? "Saving…" : "Save series"}</button>
        </form>
      )}
    </li>
  );
}
