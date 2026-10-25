"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { EventMediaEditor } from "@/components/EventMediaEditor";
import { ChoiceCards, Field, FormSection, Segmented, Stepper, StickyActions, Toggle } from "@/components/ui/Form";
import type { EventRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Series = { id: string; name: string };
type Visibility = EventRow["visibility"];

// Paid tickets need Creem configured on the server; set NEXT_PUBLIC_PAYMENTS_ENABLED=true alongside the Creem keys.
const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
const DESC_MAX = 600;

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Next Thursday 7pm local, a sensible default for a meetup. */
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
  d.setHours(19, 0, 0, 0);
  return d;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "series";
}

/** Combine a date and two times; an end time earlier than the start rolls over to the next day. */
function toRange(date: string, start: string, end: string) {
  if (!date || !start || !end) return null;
  const s = new Date(`${date}T${start}`);
  const e = new Date(`${date}T${end}`);
  if (e <= s) e.setDate(e.getDate() + 1);
  return { s, e };
}

function fmtRange(r: { s: Date; e: Date } | null) {
  if (!r) return "Pick a date and time";
  const day = r.s.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const hours = Math.round(((r.e.getTime() - r.s.getTime()) / 36e5) * 10) / 10;
  return `${day}, ${t(r.s)} to ${t(r.e)} (${hours}h)`;
}

const VISIBILITY: { value: Visibility; label: string; description: string; icon: string }[] = [
  { value: "public", label: "Public", description: "Anyone can find it and browse the board.", icon: "🌍" },
  { value: "unlisted", label: "Unlisted", description: "Only people with the code or QR can join.", icon: "🔗" },
  { value: "invite_only", label: "Invite only", description: "Only emails you add can check in.", icon: "✉️" },
];

export function EventForm({ userId, series, event }: { userId: string; series: Series[]; event?: EventRow }) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const start0 = event ? new Date(event.starts_at) : defaultStart();
  const end0 = event ? new Date(event.ends_at) : new Date(start0.getTime() + 3 * 36e5);

  const [f, setF] = useState({
    name: event?.name ?? "",
    description: event?.description ?? "",
    date: dateOf(start0),
    start: timeOf(start0),
    end: timeOf(end0),
    venue: event?.venue ?? "",
    city: event?.city ?? "",
    images: [event?.cover_url, ...(event?.gallery_urls ?? [])].filter((u): u is string => !!u),
    video_url: event?.video_url ?? (null as string | null),
    capacity: event?.capacity?.toString() ?? "",
    limited: !!event?.capacity,
    visibility: (event?.visibility ?? "public") as Visibility,
    seriesMode: (event?.series_id ? "existing" : "none") as "none" | "existing" | "new",
    series_id: event?.series_id ?? series[0]?.id ?? "",
    new_series: "",
    paid: !!event?.ticket_price_cents,
    price: event?.ticket_price_cents ? (event.ticket_price_cents / 100).toString() : "10",
  });
  const patch = (p: Partial<typeof f>) => setF((prev) => ({ ...prev, ...p }));
  const bind = (k: "name" | "description" | "date" | "start" | "end" | "venue" | "city" | "new_series") => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patch({ [k]: e.target.value }),
  });

  const range = useMemo(() => toRange(f.date, f.start, f.end), [f.date, f.start, f.end]);
  const setDuration = (h: number) => {
    if (!f.start) return;
    const [hh, mm] = f.start.split(":").map(Number);
    const total = (hh * 60 + mm + h * 60) % (24 * 60);
    patch({ end: `${pad(Math.floor(total / 60))}:${pad(total % 60)}` });
  };
  const duration = range ? (range.e.getTime() - range.s.getTime()) / 36e5 : 0;

  const errors = {
    name: !f.name.trim() ? "Give your event a name" : null,
    when: !range ? "Pick a date, start and end time" : !event && range.e.getTime() < Date.now() ? "This time is already in the past" : duration > 24 ? "Events can run up to 24 hours" : null,
    images: f.images.length === 0 ? "Add at least one photo. It becomes the cover." : null,
    capacity: f.limited && !(Number(f.capacity) >= 1) ? "Set a capacity of at least 1" : null,
    price: PAYMENTS_ENABLED && f.paid && !(Number(f.price) >= 1) ? "Tickets start at 1.00" : null,
    series: f.seriesMode === "new" && !f.new_series.trim() ? "Name your series" : f.seriesMode === "existing" && !f.series_id ? "Pick a series" : null,
  };
  const firstError = Object.values(errors).find(Boolean);
  const show = (k: keyof typeof errors) => (tried ? errors[k] : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (firstError || !range) {
      toast(firstError ?? "Check the form", { kind: "error" });
      document.querySelector("[aria-invalid='true'], [data-invalid='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);

    let seriesId: string | null = f.seriesMode === "existing" ? f.series_id || null : null;
    if (f.seriesMode === "new") {
      const { data, error } = await supabase.from("event_series")
        .insert({ organizer_id: userId, name: f.new_series.trim(), slug: `${slugify(f.new_series)}-${Math.random().toString(36).slice(2, 6)}`, city: f.city.trim() || null })
        .select("id").single();
      if (error) { setBusy(false); return toast(error.message, { kind: "error" }); }
      seriesId = data.id;
    }

    const row = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      starts_at: range.s.toISOString(),
      ends_at: range.e.toISOString(),
      venue: f.venue.trim() || null,
      city: f.city.trim() || null,
      cover_url: f.images[0],
      gallery_urls: f.images.slice(1),
      video_url: f.video_url,
      capacity: f.limited ? parseInt(f.capacity, 10) : null,
      visibility: f.visibility,
      series_id: seriesId,
      ticket_price_cents: PAYMENTS_ENABLED && f.paid ? Math.round(Number(f.price) * 100) : 0,
    };

    const res = event
      ? await supabase.from("events").update(row).eq("id", event.id).select("id").single()
      : await supabase.from("events").insert({ ...row, organizer_id: userId }).select("id").single();
    setBusy(false);
    if (res.error) return toast(res.error.message, { kind: "error" });
    toast(event ? "Saved. Looking good." : "Your event is live. Time to print that QR!", { kind: "success" });
    if (event) router.refresh();
    else router.push(`/organizer/${res.data.id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {/* Live ticket preview: updates as you type. */}
      <div aria-hidden className="ticket-edge relative overflow-hidden rounded-3xl bg-zinc-900 text-white shadow-[0_24px_60px_-28px_rgba(109,40,217,.7)]">
        <div className="relative h-32 sm:h-40">
          {f.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.images[0]} alt="" className="h-full w-full object-cover opacity-80" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400"><div className="dot-grid h-full w-full text-white/25" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/30 to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-lime-300 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-900">
            {VISIBILITY.find((v) => v.value === f.visibility)?.label}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-dashed border-white/15 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-display text-2xl font-extrabold leading-tight">{f.name.trim() || "Your event name"}</p>
            <p className="mt-0.5 truncate text-sm text-zinc-300">{fmtRange(range)}</p>
            <p className="truncate text-sm text-zinc-400">{[f.venue, f.city].filter(Boolean).join(", ") || "Venue, city"}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Entry</p>
            <p className="font-display text-xl font-extrabold text-lime-300">{PAYMENTS_ENABLED && f.paid && Number(f.price) > 0 ? `$${Number(f.price).toFixed(2)}` : "Free"}</p>
          </div>
        </div>
      </div>

      <FormSection step={1} title="The basics" description="What should people call it, and why should they come?">
        <Field label="Event name" required htmlFor="ev-name" error={show("name")}>
          <input
            id="ev-name" className="input h-14 font-display text-xl font-bold" maxLength={100} placeholder="Indie Hackers Dubai #12"
            aria-invalid={!!show("name")} autoComplete="off" {...bind("name")}
          />
        </Field>
        <Field label="Description" optional htmlFor="ev-desc" counter={{ value: f.description.length, max: DESC_MAX }} hint="What's the vibe? Talks, demos, pizza, who should come.">
          <textarea id="ev-desc" className="input" rows={4} maxLength={DESC_MAX} placeholder="Monthly meetup for people shipping side projects. Bring your laptop and your half-finished idea." {...bind("description")} />
        </Field>
      </FormSection>

      <FormSection step={2} title="When and where" description="Most meetups run a few hours in the evening.">
        <div data-invalid={!!show("when")} className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field label="Date" htmlFor="ev-date" className="col-span-2 sm:col-span-1">
            <input id="ev-date" type="date" className="input" aria-invalid={!!show("when")} {...bind("date")} />
          </Field>
          <Field label="Starts" htmlFor="ev-start">
            <input id="ev-start" type="time" step={900} className="input" aria-invalid={!!show("when")} {...bind("start")} />
          </Field>
          <Field label="Ends" htmlFor="ev-end">
            <input id="ev-end" type="time" step={900} className="input" aria-invalid={!!show("when")} {...bind("end")} />
          </Field>
        </div>
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Length:</span>
          {[1, 2, 3, 4].map((h) => (
            <button
              key={h} type="button" onClick={() => setDuration(h)}
              className={cn("min-h-[34px] rounded-full px-3 text-xs font-bold ring-1 ring-inset transition",
                Math.abs(duration - h) < 0.01 ? "bg-brand text-white ring-brand" : "ring-zinc-200 hover:ring-zinc-400 dark:ring-zinc-700")}
            >
              {h} {h === 1 ? "hour" : "hours"}
            </button>
          ))}
          <span className={cn("ml-auto text-xs font-medium", show("when") ? "text-red-600" : "text-zinc-500 dark:text-zinc-400")}>
            {show("when") ?? fmtRange(range)}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Venue" optional htmlFor="ev-venue">
            <input id="ev-venue" className="input" placeholder="Astrolabs, Cluster R" autoComplete="off" {...bind("venue")} />
          </Field>
          <Field label="City" optional htmlFor="ev-city">
            <input id="ev-city" className="input" placeholder="Dubai" autoComplete="address-level2" {...bind("city")} />
          </Field>
        </div>
      </FormSection>

      <FormSection step={3} title="Make it look good" description="Great photos get more check-ins. The first one is your cover.">
        <div data-invalid={!!show("images")}>
          <EventMediaEditor
            userId={userId}
            images={f.images}
            video={f.video_url}
            onChange={({ images, video }) => patch({ images, video_url: video })}
          />
          {show("images") && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{show("images")}</p>}
        </div>
      </FormSection>

      <FormSection step={4} title="Who gets in" description="You can change all of this later.">
        <ChoiceCards label="Visibility" options={VISIBILITY} value={f.visibility} onChange={(v) => patch({ visibility: v })} />
        {f.visibility === "invite_only" && (
          <p className="-mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            After you create the event, add guest emails on the manage page.
          </p>
        )}

        <Toggle label="Limit capacity" description="Check-ins stop once the room is full." checked={f.limited} onChange={(v) => patch({ limited: v, capacity: v && !f.capacity ? "50" : f.capacity })} />
        {f.limited && (
          <Field label="Capacity" htmlFor="ev-cap" error={show("capacity")}>
            <Stepper id="ev-cap" value={f.capacity} onChange={(v) => patch({ capacity: v })} min={1} max={5000} step={5} suffix="people" />
          </Field>
        )}

        {PAYMENTS_ENABLED && (
          <>
            <Toggle label="Sell tickets" description="Attendees pay before they can check in. Payments run through Creem." checked={f.paid} onChange={(v) => patch({ paid: v })} />
            {f.paid && (
              <Field label="Ticket price (USD)" htmlFor="ev-price" error={show("price")}>
                <Stepper id="ev-price" value={f.price} onChange={(v) => patch({ price: v })} min={1} max={1000} step={1} prefix="$" />
              </Field>
            )}
          </>
        )}
      </FormSection>

      <FormSection step={5} title="Part of a series?" description="Recurring meetups get their own community page.">
        <Segmented
          label="Series" hideLabel value={f.seriesMode} onChange={(v) => patch({ seriesMode: v })}
          options={[
            { value: "none", label: "One-off" },
            ...(series.length ? [{ value: "existing" as const, label: "Existing" }] : []),
            { value: "new", label: "New series" },
          ]}
        />
        {f.seriesMode === "existing" && (
          <Field label="Series" htmlFor="ev-series" error={show("series")}>
            <select id="ev-series" className="input" value={f.series_id} onChange={(e) => patch({ series_id: e.target.value })}>
              {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        {f.seriesMode === "new" && (
          <Field label="Series name" htmlFor="ev-new-series" error={show("series")}>
            <input id="ev-new-series" className="input" placeholder="Indie Hackers Dubai" aria-invalid={!!show("series")} {...bind("new_series")} />
          </Field>
        )}
      </FormSection>

      <StickyActions>
        <p className="hidden min-w-0 flex-1 truncate text-sm text-zinc-600 dark:text-zinc-400 sm:block">
          {tried && firstError ? <span className="font-medium text-red-600">{firstError}</span> : fmtRange(range)}
        </p>
        <button className="btn-primary w-full sm:w-auto sm:min-w-[200px]" disabled={busy}>
          {busy ? "Saving…" : event ? "Save changes" : "Create event 🎉"}
        </button>
      </StickyActions>
    </form>
  );
}
