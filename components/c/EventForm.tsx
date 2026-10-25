"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { EventMediaEditor } from "@/components/EventMediaEditor";
import type { EventRow } from "@/lib/types";

type Series = { id: string; name: string };

// Paid tickets need Stripe configured on the server; set NEXT_PUBLIC_STRIPE_ENABLED=true alongside the Stripe keys.
const STRIPE_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";

const toLocal = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "series";
}

export function EventForm({ userId, series, event }: { userId: string; series: Series[]; event?: EventRow }) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: event?.name ?? "",
    description: event?.description ?? "",
    starts_at: toLocal(event?.starts_at),
    ends_at: toLocal(event?.ends_at),
    venue: event?.venue ?? "",
    city: event?.city ?? "",
    images: [event?.cover_url, ...(event?.gallery_urls ?? [])].filter((u): u is string => !!u),
    video_url: event?.video_url ?? null as string | null,
    capacity: event?.capacity?.toString() ?? "",
    visibility: event?.visibility ?? "public",
    series_id: event?.series_id ?? "",
    new_series: "",
    price: event ? (event.ticket_price_cents / 100).toString() : "0",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.starts_at || !f.ends_at) return toast("Start and end times are required", { kind: "error" });
    if (new Date(f.ends_at) <= new Date(f.starts_at)) return toast("End must be after start", { kind: "error" });
    if (f.images.length === 0) return toast("Add at least one event photo", { kind: "error" });
    setBusy(true);

    let seriesId: string | null = f.series_id && f.series_id !== "__new" ? f.series_id : null;
    if (f.series_id === "__new" && f.new_series.trim()) {
      const { data, error } = await supabase.from("event_series")
        .insert({ organizer_id: userId, name: f.new_series.trim(), slug: `${slugify(f.new_series)}-${Math.random().toString(36).slice(2, 6)}`, city: f.city || null })
        .select("id").single();
      if (error) { setBusy(false); return toast(error.message, { kind: "error" }); }
      seriesId = data.id;
    }

    const row = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      starts_at: new Date(f.starts_at).toISOString(),
      ends_at: new Date(f.ends_at).toISOString(),
      venue: f.venue.trim() || null,
      city: f.city.trim() || null,
      cover_url: f.images[0],
      gallery_urls: f.images.slice(1),
      video_url: f.video_url,
      capacity: f.capacity ? parseInt(f.capacity, 10) : null,
      visibility: f.visibility,
      series_id: seriesId,
      ticket_price_cents: STRIPE_ENABLED ? Math.round((parseFloat(f.price) || 0) * 100) : 0,
    };

    const res = event
      ? await supabase.from("events").update(row).eq("id", event.id).select("id").single()
      : await supabase.from("events").insert({ ...row, organizer_id: userId }).select("id").single();
    setBusy(false);
    if (res.error) return toast(res.error.message, { kind: "error" });
    toast(event ? "Event updated" : "Event created!", { kind: "success" });
    if (event) router.refresh();
    else router.push(`/organizer/${res.data.id}`);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="ev-name">Event name</label>
        <input id="ev-name" className="input" required maxLength={100} value={f.name} onChange={set("name")} placeholder="Indie Hackers Dubai #12" />
      </div>
      <div>
        <label className="label" htmlFor="ev-desc">Description</label>
        <textarea id="ev-desc" className="input" rows={3} value={f.description} onChange={set("description")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ev-start">Starts</label>
          <input id="ev-start" type="datetime-local" className="input" required value={f.starts_at} onChange={set("starts_at")} />
        </div>
        <div>
          <label className="label" htmlFor="ev-end">Ends</label>
          <input id="ev-end" type="datetime-local" className="input" required value={f.ends_at} onChange={set("ends_at")} />
        </div>
        <div>
          <label className="label" htmlFor="ev-venue">Venue</label>
          <input id="ev-venue" className="input" value={f.venue} onChange={set("venue")} />
        </div>
        <div>
          <label className="label" htmlFor="ev-city">City</label>
          <input id="ev-city" className="input" value={f.city} onChange={set("city")} />
        </div>
        <div>
          <label className="label" htmlFor="ev-cap">Capacity (optional)</label>
          <input id="ev-cap" type="number" min={1} inputMode="numeric" className="input" value={f.capacity} onChange={set("capacity")} />
        </div>
        <div>
          <label className="label" htmlFor="ev-vis">Visibility</label>
          <select id="ev-vis" className="input" value={f.visibility} onChange={set("visibility")}>
            <option value="public">Public: listed, board open to all</option>
            <option value="unlisted">Unlisted: anyone with the code</option>
            <option value="invite_only">Invite-only: invited emails</option>
          </select>
        </div>
        {STRIPE_ENABLED && (
        <div>
            <label className="label" htmlFor="ev-price">Ticket price (USD, 0 = free)</label>
            <input id="ev-price" type="number" min={0} step="0.01" inputMode="decimal" className="input" value={f.price} onChange={set("price")} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="ev-series">Series (recurring)</label>
          <select id="ev-series" className="input" value={f.series_id} onChange={set("series_id")}>
            <option value="">None</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="__new">+ New series…</option>
          </select>
          {f.series_id === "__new" && (
            <input className="input mt-2" placeholder="Series name" value={f.new_series} onChange={set("new_series")} aria-label="New series name" />
          )}
        </div>
      </div>
      <EventMediaEditor
        userId={userId}
        images={f.images}
        video={f.video_url}
        onChange={({ images, video }) => setF((prev) => ({ ...prev, images, video_url: video }))}
      />
      <button className="btn-primary w-full" disabled={busy || !f.name.trim() || f.images.length === 0}>{busy ? "Saving…" : event ? "Save changes" : "Create event"}</button>
    </form>
  );
}
