"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Sheet } from "@/components/b/Sheet";
import { Field, Toggle } from "@/components/ui/Form";
import { fmtRangeInZone, utcToZoned, zonedToUtc } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import { HIcon } from "./ui";

/** Duplicate, cancel / restore and delete an event. */
export function LifecyclePanel({ event, isOwner, guestCount }: { event: EventRow; isOwner: boolean; guestCount: number }) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const tz = event.timezone || "UTC";
  const cancelled = !!event.cancelled_at;

  // Duplicate defaults: same weekday and times, one week later.
  const start0 = utcToZoned(new Date(new Date(event.starts_at).getTime() + 7 * 864e5), tz);
  const end0 = utcToZoned(event.ends_at, tz);
  const [dupOpen, setDupOpen] = useState(false);
  const [dup, setDup] = useState({ date: start0.date, start: start0.time, end: end0.time });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    if (!dup.date || !dup.start || !dup.end) return null;
    const s = zonedToUtc(dup.date, dup.start, tz);
    let e = zonedToUtc(dup.date, dup.end, tz);
    if (e <= s) e = new Date(e.getTime() + 864e5);
    return { s, e };
  }, [dup, tz]);

  const duplicate = async () => {
    if (!range) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("duplicate_event", { p_event: event.id, p_starts: range.s.toISOString(), p_ends: range.e.toISOString() });
    setBusy(false);
    if (error) return toast(error.message, { kind: "error" });
    toast("Duplicated. Here's your new event.", { kind: "success" });
    setDupOpen(false);
    router.push(`/organizer/${data}`);
  };

  const cancel = async () => {
    setBusy(true);
    let emailed: number | null = null;
    try {
      const res = await fetch(`/api/events/${event.id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reason.trim(), notify }) });
      if (res.status === 404 || res.status === 405 || res.status === 501) throw new Error("route-missing");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setBusy(false); return toast(data.error || "Couldn't cancel the event", { kind: "error" }); }
      emailed = data.emailed ?? 0;
    } catch {
      const { error } = await supabase.rpc("cancel_event", { p_event: event.id, p_reason: reason.trim() || null });
      if (error) { setBusy(false); return toast(error.message, { kind: "error" }); }
    }
    setBusy(false);
    setCancelOpen(false);
    toast(emailed ? `Event cancelled. ${emailed} guests emailed.` : "Event cancelled. Guests see it on the event page.");
    router.refresh();
  };

  const restore = async () => {
    const { error } = await supabase.rpc("uncancel_event", { p_event: event.id });
    if (error) return toast(error.message, { kind: "error" });
    toast("Event restored. Registration and check-in are open again.", { kind: "success" });
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("Delete this event permanently? Guests, check-ins and the board are removed for everyone. This can't be undone.")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) return toast(error.message, { kind: "error" });
    router.push("/organizer");
  };

  return (
    <section aria-label="Event lifecycle" className="space-y-3">
      <h3 className="text-lg font-extrabold">Lifecycle</h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button type="button" onClick={() => setDupOpen(true)} className="card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-brand dark:bg-violet-950/60 dark:text-violet-300"><HIcon name="copy" /></span>
          <span><span className="block font-bold">Duplicate event</span><span className="text-sm text-zinc-600 dark:text-zinc-400">Same details and settings, new date. Guests aren&apos;t copied.</span></span>
        </button>
        {cancelled ? (
          <button type="button" onClick={restore} className="card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300"><HIcon name="undo" /></span>
            <span><span className="block font-bold">Restore event</span><span className="text-sm text-zinc-600 dark:text-zinc-400">Undo the cancellation and reopen registration.</span></span>
          </button>
        ) : (
          <button type="button" onClick={() => setCancelOpen(true)} className="card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"><HIcon name="x" /></span>
            <span><span className="block font-bold">Cancel event</span><span className="text-sm text-zinc-600 dark:text-zinc-400">Keeps the page up with a notice and tells your guests.</span></span>
          </button>
        )}
      </div>

      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 ring-1 ring-inset ring-red-200 dark:ring-red-900/60">
          <div>
            <p className="font-bold text-red-700 dark:text-red-400">Delete event</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Removes the event, guests, check-ins and board for everyone. Cancel instead if people should know.</p>
          </div>
          <button className="btn-danger btn-sm" onClick={remove}>Delete</button>
        </div>
      )}

      <Sheet open={dupOpen} onClose={() => !busy && setDupOpen(false)} title="Duplicate event" subtitle={`Times are in ${tz}.`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <Field label="Date" htmlFor="dup-date" className="col-span-2 sm:col-span-1">
              <input id="dup-date" type="date" className="input" value={dup.date} onChange={(e) => setDup({ ...dup, date: e.target.value })} />
            </Field>
            <Field label="Starts" htmlFor="dup-start">
              <input id="dup-start" type="time" step={900} className="input" value={dup.start} onChange={(e) => setDup({ ...dup, start: e.target.value })} />
            </Field>
            <Field label="Ends" htmlFor="dup-end">
              <input id="dup-end" type="time" step={900} className="input" value={dup.end} onChange={(e) => setDup({ ...dup, end: e.target.value })} />
            </Field>
          </div>
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-800/60">
            {range ? fmtRangeInZone(range.s.toISOString(), range.e.toISOString(), tz) : "Pick a date and times"}
          </p>
          <p className="text-xs text-zinc-500">Copies the name, description, photos, location, capacity, questions, approval and waitlist settings, series and sponsors. You get a new door code.</p>
          <button className="btn-primary w-full" disabled={busy || !range} onClick={duplicate}>{busy ? "Duplicating…" : "Create duplicate"}</button>
        </div>
      </Sheet>

      <Sheet open={cancelOpen} onClose={() => !busy && setCancelOpen(false)} title="Cancel this event?" subtitle={`${guestCount} ${guestCount === 1 ? "guest is" : "guests are"} registered or checked in.`}>
        <div className="space-y-4">
          <Field label="Reason" optional htmlFor="cx-reason" counter={{ value: reason.length, max: 500 }} hint="Shown on the event page and in the email.">
            <textarea id="cx-reason" className="input" rows={3} maxLength={500} placeholder="The venue had a power cut. We'll be back next month!" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Toggle label="Email guests" description="Sends the reason to everyone registered, if email is set up." checked={notify} onChange={setNotify} />
          <p className="text-xs text-zinc-500">The event page stays up with a cancelled notice, and check-in and registration close. You can restore it later.</p>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setCancelOpen(false)} disabled={busy}>Keep event</button>
            <button className="btn-danger flex-1" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel event"}</button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
