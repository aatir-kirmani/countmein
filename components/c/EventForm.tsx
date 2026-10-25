"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { EventMediaEditor } from "@/components/EventMediaEditor";
import { ChoiceCards, Field, FormSection, Segmented, Stepper, StickyActions, Toggle } from "@/components/ui/Form";
import { Sheet } from "@/components/b/Sheet";
import type { EventRow, RegistrationQuestion } from "@/lib/types";
import { cn, isGoogleMapsUrl } from "@/lib/utils";
import { browserTimeZone, fmtInZone, timeZoneOptions, tzLabel, utcToZoned, zonedToUtc } from "@/lib/time";

type Series = { id: string; name: string };
type Visibility = EventRow["visibility"];

// Paid tickets need Creem configured on the server; set NEXT_PUBLIC_PAYMENTS_ENABLED=true alongside the Creem keys.
const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
const DESC_MAX = 600;
const MAX_QUESTIONS = 10;

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Next Thursday's date: a sensible default for a meetup (time defaults to 7pm in the event's zone). */
function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
  return dateOf(d);
}

function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`;
}

type IdResult = { data: { id: string } | null; error: { message: string } | null };

/** Reject if a request takes longer than `ms` so the form never spins forever. */
function withTimeout<T>(p: PromiseLike<T>, ms = 20000): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "series";
}

/** Wall-clock date and times in `tz` to UTC instants; an end time earlier than the start rolls to the next day. */
export function toRange(date: string, start: string, end: string, tz: string) {
  if (!date || !start || !end) return null;
  const s = zonedToUtc(date, start, tz);
  let e = zonedToUtc(date, end, tz);
  if (e <= s) e = zonedToUtc(nextDay(date), end, tz);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  return { s, e };
}

export function fmtRange(r: { s: Date; e: Date } | null, tz: string) {
  if (!r) return "Pick a date and time";
  const si = r.s.toISOString();
  const day = fmtInZone(si, tz, { weekday: "short", day: "numeric", month: "short" });
  const t = (d: Date) => fmtInZone(d.toISOString(), tz, { hour: "numeric", minute: "2-digit" });
  const hours = Math.round(((r.e.getTime() - r.s.getTime()) / 36e5) * 10) / 10;
  return `${day}, ${t(r.s)} to ${t(r.e)} ${tzLabel(si, tz)} (${hours}h)`;
}

const newQuestionId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8);

/** Prefilled guest update after the time or place changes. */
export function updateMessage(name: string, moved: boolean, relocated: boolean, when: string, where: string, details: string | null) {
  const what = moved && relocated ? "time and place" : moved ? "time" : "place";
  const lines = [
    `Heads up: we've updated the ${what} for ${name}.`,
    "",
    `When: ${when.replace(/ \([\d.]+h\)$/, "")}`,
    where ? `Where: ${where}` : null,
    details ? `Finding it: ${details}` : null,
    "",
    "See you there!",
  ].filter((l): l is string => l !== null);
  return { subject: `New ${what} for ${name}`, body: lines.join("\n") };
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
  const [uploading, setUploading] = useState(false);
  const [tried, setTried] = useState(false);

  // Browser-dependent values (time zone, zone list, today's date) are filled in after mount so server and client HTML match.
  const [mounted, setMounted] = useState(false);
  const tz0 = event?.timezone || "UTC";
  const [zones, setZones] = useState<string[]>(() => Array.from(new Set([tz0, "UTC"])));
  const start0 = event ? utcToZoned(event.starts_at, tz0) : { date: "", time: "19:00" };
  const end0 = event ? utcToZoned(event.ends_at, tz0) : { date: start0.date, time: "22:00" };
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notify, setNotify] = useState({ subject: "", body: "" });
  const [notifying, setNotifying] = useState(false);

  const [f, setF] = useState({
    name: event?.name ?? "",
    description: event?.description ?? "",
    timezone: tz0,
    date: start0.date,
    start: start0.time,
    end: end0.time,
    venue: event?.venue ?? "",
    city: event?.city ?? "",
    maps_url: event?.maps_url ?? "",
    location_details: event?.location_details ?? "",
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
    require_approval: event?.require_approval ?? false,
    waitlist_enabled: event?.waitlist_enabled ?? false,
    registration_open: event?.registration_open ?? true,
    show_guest_list: event?.show_guest_list ?? true,
    questions: (event?.registration_questions ?? []) as RegistrationQuestion[],
  });
  const patch = (p: Partial<typeof f>) => setF((prev) => ({ ...prev, ...p }));
  useEffect(() => {
    setMounted(true);
    setZones(timeZoneOptions());
    if (!event) setF((prev) => ({ ...prev, timezone: browserTimeZone(), date: prev.date || defaultDate() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bind = (k: "name" | "description" | "date" | "start" | "end" | "venue" | "city" | "maps_url" | "location_details" | "new_series") => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patch({ [k]: e.target.value }),
  });

  const range = useMemo(() => toRange(f.date, f.start, f.end, f.timezone), [f.date, f.start, f.end, f.timezone]);
  const zoneHint = useMemo(() => {
    if (!range || !mounted) return null;
    const mine = browserTimeZone();
    if (mine === f.timezone) return `Times are in your time zone (${tzLabel(range.s, f.timezone)}).`;
    return `That's ${fmtInZone(range.s.toISOString(), mine, { weekday: "short", hour: "numeric", minute: "2-digit" })} your time (${tzLabel(range.s, mine)}).`;
  }, [range, f.timezone, mounted]);

  const setQuestion = (id: string, p: Partial<RegistrationQuestion>) => patch({ questions: f.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) });
  const addQuestion = () => { if (f.questions.length < MAX_QUESTIONS) patch({ questions: [...f.questions, { id: newQuestionId(), label: "", required: false }] }); };
  const removeQuestion = (id: string) => patch({ questions: f.questions.filter((q) => q.id !== id) });
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
    maps: f.maps_url.trim() && !isGoogleMapsUrl(f.maps_url) ? "Paste a Google Maps link, like https://maps.app.goo.gl/..." : null,
    images: f.images.length === 0 ? "Add at least one photo. It becomes the cover." : null,
    capacity: f.limited && !(Number(f.capacity) >= 1) ? "Set a capacity of at least 1" : null,
    price: PAYMENTS_ENABLED && f.paid && !(Number(f.price) >= 1) ? "Tickets start at 1.00" : null,
    series: f.seriesMode === "new" && !f.new_series.trim() ? "Name your series" : f.seriesMode === "existing" && !f.series_id ? "Pick a series" : null,
    questions: f.questions.some((q) => !q.label.trim()) ? "Write each question, or remove the empty ones" : null,
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
    if (uploading) return toast("Hang on, your photos or video are still uploading", { kind: "error" });
    setBusy(true);
    try {
    let seriesId: string | null = f.seriesMode === "existing" ? f.series_id || null : null;
    if (f.seriesMode === "new") {
      const { data, error } = await withTimeout<IdResult>(supabase.from("event_series")
        .insert({ organizer_id: userId, name: f.new_series.trim(), slug: `${slugify(f.new_series)}-${Math.random().toString(36).slice(2, 6)}`, city: f.city.trim() || null })
        .select("id").single());
      if (error) return toast(error.message, { kind: "error" });
      seriesId = data!.id;
    }

    const row = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      starts_at: range.s.toISOString(),
      ends_at: range.e.toISOString(),
      venue: f.venue.trim() || null,
      city: f.city.trim() || null,
      maps_url: f.maps_url.trim() || null,
      location_details: f.location_details.trim() || null,
      cover_url: f.images[0],
      gallery_urls: f.images.slice(1),
      video_url: f.video_url,
      capacity: f.limited ? parseInt(f.capacity, 10) : null,
      visibility: f.visibility,
      series_id: seriesId,
      ticket_price_cents: PAYMENTS_ENABLED && f.paid ? Math.round(Number(f.price) * 100) : 0,
      timezone: f.timezone,
      require_approval: f.require_approval,
      waitlist_enabled: f.limited && f.waitlist_enabled,
      registration_open: f.registration_open,
      show_guest_list: f.show_guest_list,
      registration_questions: f.questions.map((q) => ({ id: q.id, label: q.label.trim().slice(0, 140), required: q.required })),
    };

    const res = await withTimeout<IdResult>(event
      ? supabase.from("events").update(row).eq("id", event.id).select("id").single()
      : supabase.from("events").insert({ ...row, organizer_id: userId }).select("id").single());
    if (res.error) return toast(res.error.message, { kind: "error" });
    toast(event ? "Saved. Looking good." : "Your event is live. Time to print that QR!", { kind: "success" });
    if (!event) return router.push(`/organizer/${res.data!.id}`);
    const moved = row.starts_at !== new Date(event.starts_at).toISOString() || row.ends_at !== new Date(event.ends_at).toISOString() || row.timezone !== event.timezone;
    const relocated = (row.venue ?? "") !== (event.venue ?? "") || (row.city ?? "") !== (event.city ?? "") || (row.maps_url ?? "") !== (event.maps_url ?? "");
    if ((moved || relocated) && !event.cancelled_at) {
      setNotify(updateMessage(row.name, moved, relocated, fmtRange(range, f.timezone), [row.venue, row.city].filter(Boolean).join(", "), row.location_details));
      setNotifyOpen(true);
    }
    router.refresh();
    } catch (err) {
      toast(err instanceof Error && err.message === "timeout"
        ? "Saving is taking too long. Check your connection and try again."
        : "Something went wrong while saving. Please try again.", { kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const sendNotify = async () => {
    if (!event) return;
    setNotifying(true);
    const res = await fetch(`/api/events/${event.id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: notify.subject, body: notify.body, audience: "all" }),
    });
    const data = await res.json().catch(() => ({}));
    setNotifying(false);
    if (!res.ok) return toast(data.error ?? "Couldn't send the update", { kind: "error" });
    setNotifyOpen(false);
    toast(
      data.configured
        ? `Update sent${data.emailed ? ` to ${data.emailed} ${data.emailed === 1 ? "guest" : "guests"}` : ""}. It's on the event page too.`
        : "Update posted on the event page. Email isn't set up yet.",
      { kind: "success" },
    );
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
            <p className="mt-0.5 truncate text-sm text-zinc-300">{fmtRange(range, f.timezone)}</p>
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
            {show("when") ?? fmtRange(range, f.timezone)}
          </span>
        </div>
        <Field label="Time zone" htmlFor="ev-tz" hint={zoneHint}>
          <select id="ev-tz" className="input" value={f.timezone} onChange={(e) => patch({ timezone: e.target.value })}>
            {(zones.includes(f.timezone) ? zones : [f.timezone, ...zones]).map((z) => (
              <option key={z} value={z}>{z.replace(/_/g, " ")} ({tzLabel(range?.s ?? new Date(), z)})</option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Venue" optional htmlFor="ev-venue">
            <input id="ev-venue" className="input" placeholder="Astrolabs, Cluster R" autoComplete="off" {...bind("venue")} />
          </Field>
          <Field label="City" optional htmlFor="ev-city">
            <input id="ev-city" className="input" placeholder="Dubai" autoComplete="address-level2" {...bind("city")} />
          </Field>
        </div>
        <Field
          label="Google Maps link" optional htmlFor="ev-maps" error={show("maps")}
          hint={
            <>
              In Google Maps, find the place, tap <b>Share</b>, then <b>Copy link</b>.{" "}
              {(f.venue.trim() || f.city.trim()) && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([f.venue, f.city].filter((x) => x.trim()).join(", "))}`}
                  target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline underline-offset-2 dark:text-violet-400"
                >
                  Find &ldquo;{[f.venue, f.city].filter((x) => x.trim()).join(", ")}&rdquo; on Maps ↗
                </a>
              )}
            </>
          }
        >
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">📍</span>
            <input
              id="ev-maps" type="url" inputMode="url" className="input pl-11" placeholder="https://maps.app.goo.gl/..." autoComplete="off"
              aria-invalid={!!show("maps")} {...bind("maps_url")}
            />
          </div>
        </Field>
        <Field
          label="How to find it" optional htmlFor="ev-loc" counter={{ value: f.location_details.length, max: 500 }}
          hint="Floor, entrance, parking, who to ask at reception. Shown on the event page under Getting there."
        >
          <textarea
            id="ev-loc" className="input min-h-[88px]" rows={3} maxLength={500}
            placeholder="Level 3, take the lift by Costa. Free parking in P2, ask security for the Countmein meetup."
            {...bind("location_details")}
          />
        </Field>
      </FormSection>

      <FormSection step={3} title="Make it look good" description="Great photos get more check-ins. The first one is your cover.">
        <div data-invalid={!!show("images")}>
          <EventMediaEditor
            userId={userId}
            images={f.images}
            video={f.video_url}
            onChange={({ images, video }) => patch({ images, video_url: video })}
            onBusyChange={setUploading}
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

        <Toggle label="Limit capacity" description="Registrations stop once the room is full." checked={f.limited} onChange={(v) => patch({ limited: v, capacity: v && !f.capacity ? "50" : f.capacity })} />
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

      <FormSection step={5} title="Registration" description="Decide who gets a spot and what you'd like to know about them.">
        <div className="grid gap-2.5">
          <Toggle
            label="Require approval" description="Guests request to join and you approve them. Great for curated rooms."
            checked={f.require_approval} onChange={(v) => patch({ require_approval: v })}
          />
          {f.limited && (
            <Toggle
              label="Waitlist when full" description="Once capacity is reached, new guests join a waitlist. Spots are filled in order when someone cancels."
              checked={f.waitlist_enabled} onChange={(v) => patch({ waitlist_enabled: v })}
            />
          )}
          <Toggle
            label="Registration open" description="Turn off to stop new sign-ups. Registered guests can still check in."
            checked={f.registration_open} onChange={(v) => patch({ registration_open: v })}
          />
          <Toggle
            label="Show guest list on the event page" description="Faces and the going count are shown to visitors. Checked-in attendees always see who's in the room."
            checked={f.show_guest_list} onChange={(v) => patch({ show_guest_list: v })}
          />
        </div>

        <fieldset data-invalid={!!show("questions")}>
          <legend className="label">Registration questions <span className="text-xs font-medium text-zinc-400">optional</span></legend>
          <p className="hint -mt-1 mb-3">Asked when someone registers. Answers show up in your guest list. Up to {MAX_QUESTIONS}.</p>
          <div className="space-y-2.5">
            {f.questions.map((q, i) => (
              <div key={q.id} className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800/40 dark:ring-zinc-700/70">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white font-mono text-xs font-bold text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">{i + 1}</span>
                  <label htmlFor={`q-${q.id}`} className="sr-only">Question {i + 1}</label>
                  <input
                    id={`q-${q.id}`} className="input h-11 flex-1 bg-white dark:bg-zinc-900" maxLength={140} placeholder={i === 0 ? "What are you building?" : "Ask anything"}
                    value={q.label} aria-invalid={tried && !q.label.trim()} onChange={(e) => setQuestion(q.id, { label: e.target.value })}
                  />
                  <button type="button" onClick={() => removeQuestion(q.id)} className="btn-ghost btn-sm px-2.5 text-zinc-500" aria-label={`Remove question ${i + 1}`}>✕</button>
                </div>
                <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 pl-9 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  <input type="checkbox" className="h-4 w-4 accent-[#6d28d9]" checked={q.required} onChange={(e) => setQuestion(q.id, { required: e.target.checked })} />
                  Required
                </label>
              </div>
            ))}
            {f.questions.length < MAX_QUESTIONS && (
              <button
                type="button" onClick={addQuestion}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 text-sm font-bold text-zinc-600 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-400"
              >
                <span aria-hidden>＋</span> {f.questions.length ? "Add another question" : "Add a question"}
              </button>
            )}
          </div>
          {show("questions") && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{show("questions")}</p>}
          {f.questions.some((q) => q.required) && !f.require_approval && (
            <p className="hint">With a required question, walk-ins register first, then check in.</p>
          )}
        </fieldset>
      </FormSection>

      <FormSection step={6} title="Part of a series?" description="Recurring meetups get their own community page.">
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
          {tried && firstError ? <span className="font-medium text-red-600">{firstError}</span> : fmtRange(range, f.timezone)}
        </p>
        <button className="btn-primary w-full sm:w-auto sm:min-w-[200px]" disabled={busy || uploading}>
          {busy ? "Saving…" : uploading ? "Uploading media…" : event ? "Save changes" : "Create event 🎉"}
        </button>
      </StickyActions>

      <Sheet open={notifyOpen} onClose={() => { if (!notifying) setNotifyOpen(false); }} title="Let your guests know?" subtitle="We'll post this on the event page and email registered guests.">
        <div className="space-y-4">
          <Field label="Subject" htmlFor="nt-subject">
            <input id="nt-subject" className="input" maxLength={140} value={notify.subject} onChange={(e) => setNotify({ ...notify, subject: e.target.value })} />
          </Field>
          <Field label="Message" htmlFor="nt-body" counter={{ value: notify.body.length, max: 4000 }}>
            <textarea id="nt-body" className="input min-h-[160px]" maxLength={4000} value={notify.body} onChange={(e) => setNotify({ ...notify, body: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setNotifyOpen(false)} disabled={notifying}>Not now</button>
            <button type="button" className="btn-primary flex-1" onClick={sendNotify} disabled={notifying || !notify.subject.trim() || !notify.body.trim()}>
              {notifying ? "Sending…" : "Send update"}
            </button>
          </div>
        </div>
      </Sheet>
    </form>
  );
}
