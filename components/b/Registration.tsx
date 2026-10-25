"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import type { EventMessage, EventRow, RegistrationQuestion, RegistrationStatus } from "@/lib/types";
import { cn, siteUrl, timeAgo } from "@/lib/utils";
import { googleCalendarUrl } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Field } from "@/components/ui/Form";
import { Sheet } from "./Sheet";
import { Icon } from "./ui";

export type PublicStats = { going: number; checked_in: number; waitlist: number; spots_left: number | null };
export type HostPerson = { id: string; name: string; username: string; avatar_url: string | null; role: "owner" | "cohost" | "manager" };

/** What the "not registered yet" call to action should be, given the event's settings. */
export function registrationMode(event: EventRow, stats: PublicStats | null) {
  const full = stats?.spots_left === 0;
  if (!event.registration_open) return "closed" as const;
  if (event.require_approval) return "approval" as const;
  if (full) return event.waitlist_enabled ? ("waitlist" as const) : ("full" as const);
  return "open" as const;
}

/** True when a guest can check in at the door without registering first. */
export function walkInAllowed(event: EventRow, stats: PublicStats | null) {
  const required = (event.registration_questions ?? []).some((q) => q.required);
  return event.registration_open && !event.require_approval && !required && stats?.spots_left !== 0;
}

const card = "relative overflow-hidden rounded-[2rem] p-6";
const gradient = "bg-gradient-to-br from-violet-700 via-brand to-fuchsia-700 text-white shadow-[0_20px_50px_-20px_rgba(109,40,217,.7)]";

/** Not registered yet: the main CTA, which adapts to approval, capacity and waitlist settings. */
export function RegisterCta({ event, stats, live, busy, onRegister, onCheckin, highlight, children }: {
  event: EventRow; stats: PublicStats | null; live: boolean; busy: boolean;
  onRegister: () => void; onCheckin: () => void; highlight?: boolean; children?: React.ReactNode;
}) {
  const mode = registrationMode(event, stats);
  const walkIn = live && walkInAllowed(event, stats);
  const copy = {
    open: { eyebrow: live ? "You made it" : "Save your spot", title: live ? "Are you in the room?" : "Join the guest list", body: "Register to get on the list. Checking in at the venue puts you on the live board.", cta: "Register" },
    approval: { eyebrow: "Host approval", title: "Request to join", body: "The host reviews every request. You'll hear back here and by email.", cta: "Request to join" },
    waitlist: { eyebrow: "It's packed", title: "Join the waitlist", body: "The room is full right now. If a spot opens up you'll be the first to know.", cta: "Join the waitlist" },
    full: { eyebrow: "Sold out", title: "This event is full", body: "Every spot is taken. Keep an eye on the host's next one.", cta: "Event is full" },
    closed: { eyebrow: "Registration closed", title: "The guest list is closed", body: "The host isn't taking new registrations for this event.", cta: "Registration closed" },
  }[mode];
  const disabled = mode === "full" || mode === "closed";

  return (
    <section id="checkin" className={cn(card, disabled ? "bg-zinc-900 text-white dark:ring-1 dark:ring-zinc-800" : gradient, highlight && "ring-4 ring-lime-300 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950")}>
      <div aria-hidden className="dot-grid absolute inset-0 text-white/10" />
      <div className="relative">
        {children}
        <p className="eyebrow !text-lime-300">{copy.eyebrow}</p>
        <h2 className="mt-1 text-3xl font-extrabold leading-tight">{walkIn && mode === "open" ? "Are you in the room?" : copy.title}</h2>
        <p className="mt-1 text-sm text-violet-100">{walkIn && mode === "open" ? "Check in to land on the live board so people can find you and what you're building." : copy.body}</p>
        {walkIn ? (
          <>
            <button className="btn-accent mt-5 h-14 w-full text-lg" disabled={busy} onClick={onCheckin}>{busy ? "Checking you in…" : "I'm here! 👋"}</button>
            {!live || (event.registration_questions ?? []).length === 0 ? null : (
              <button className="btn mt-2 w-full bg-white/15 text-white hover:bg-white/25" onClick={onRegister}>Answer the host&apos;s questions</button>
            )}
          </>
        ) : (
          <button className="btn-accent mt-5 h-14 w-full text-lg disabled:bg-white/15 disabled:text-white disabled:shadow-none" disabled={busy || disabled} onClick={onRegister}>
            {busy ? "One sec…" : copy.cta}
          </button>
        )}
        {stats && stats.spots_left !== null && stats.spots_left > 0 && stats.spots_left <= 10 && mode !== "closed" && (
          <p className="mt-3 text-center text-xs font-semibold text-lime-200">Only {stats.spots_left} {stats.spots_left === 1 ? "spot" : "spots"} left</p>
        )}
      </div>
    </section>
  );
}

/** Sheet with the host's registration questions. Resolves with the new status. */
export function RegisterSheet({ open, onClose, event, onDone }: {
  open: boolean; onClose: () => void; event: EventRow; onDone: (status: RegistrationStatus) => void;
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const questions: RegistrationQuestion[] = event.registration_questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const missing = questions.filter((q) => q.required && !answers[q.id]?.trim());
  const mode = event.require_approval ? "Request to join" : "Register";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (missing.length) return;
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    const { data, error } = await supabase.rpc("register_for_event", { p_event: event.id, p_answers: clean });
    setBusy(false);
    if (error) return toast(error.message, { kind: "error" });
    onDone(data as RegistrationStatus);
  };

  return (
    <Sheet open={open} onClose={onClose} title={mode} subtitle={questions.length ? "The host would like to know a little about you." : `${event.name}`}>
      <form onSubmit={submit} className="space-y-4">
        {questions.map((q) => (
          <Field key={q.id} label={q.label} required={q.required} optional={!q.required} htmlFor={`rq-${q.id}`}
            error={tried && q.required && !answers[q.id]?.trim() ? "This one's required" : null}>
            <textarea
              id={`rq-${q.id}`} className="input min-h-[84px]" rows={2} maxLength={500}
              value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              aria-invalid={tried && q.required && !answers[q.id]?.trim()}
            />
          </Field>
        ))}
        {questions.length === 0 && (
          <p className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
            {event.require_approval ? "The host will review your profile and get back to you." : "You'll get a ticket with a QR code. Show it at the door, or check in yourself when you arrive."}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : mode}</button>
      </form>
    </Sheet>
  );
}

/** Going: the guest's ticket with QR, calendar links and cancel. */
export function TicketCard({ event, userId, live, soon, busy, onCheckin, onCancel, fresh, ticketGate }: {
  event: EventRow; userId: string; live: boolean; soon: boolean; busy: boolean;
  onCheckin: () => void; onCancel: () => void; fresh?: boolean; ticketGate?: React.ReactNode;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [gcal, setGcal] = useState<string | undefined>(undefined);
  // Built after mount so server and client markup match (the site URL can differ between them).
  useEffect(() => {
    QRCode.toDataURL(`${siteUrl()}/e/${event.code}?ticket=${userId}`, { margin: 1, width: 320, color: { dark: "#18181b", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(null));
    setGcal(googleCalendarUrl(event, `${siteUrl()}/e/${event.code}`));
  }, [event, userId]);

  return (
    <section id="checkin" className={cn("ticket-edge relative overflow-hidden rounded-[2rem] bg-zinc-950 text-white ring-1 ring-zinc-800", fresh && "animate-pop")}>
      <div aria-hidden className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-lime-300/25 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4 p-6 pb-5">
        <div className="min-w-0">
          <p className="eyebrow !text-lime-300">You&apos;re in</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">See you there! 🎟️</h2>
          <p className="mt-1 text-sm text-zinc-300">Show this QR to the host at the door, or check in yourself when you arrive.</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-white p-2 shadow-lg">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Your ticket QR code" className="h-[84px] w-[84px] sm:h-28 sm:w-28" />
          ) : <div className="skeleton h-[84px] w-[84px] sm:h-28 sm:w-28" />}
        </div>
      </div>
      <div className="relative border-t border-dashed border-white/15 p-4 sm:p-5">
        {ticketGate}
        {!ticketGate && (live || soon) && (
          <button className="btn-accent mb-3 h-14 w-full text-lg" disabled={busy} onClick={onCheckin}>
            {busy ? "Checking you in…" : live ? "I'm here! Check me in 👋" : "Check in early ✋"}
          </button>
        )}
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Add to calendar</p>
        <div className="grid grid-cols-2 gap-2">
          <a className="btn btn-sm whitespace-nowrap bg-white/10 text-white hover:bg-white/20" href={gcal} target="_blank" rel="noopener noreferrer">
            <Icon name="calendar" className="h-4 w-4 shrink-0" /> Google
          </a>
          <a className="btn btn-sm whitespace-nowrap bg-white/10 text-white hover:bg-white/20" href={`/api/ics/${event.code}`} download>
            <Icon name="calendar" className="h-4 w-4 shrink-0" /> Apple, Outlook
          </a>
        </div>
        {confirm ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 p-2 pl-4 text-sm">
            <span className="flex-1">Give up your spot?</span>
            <button className="btn-ghost btn-sm text-white hover:bg-white/10" onClick={() => setConfirm(false)}>Keep it</button>
            <button className="btn-danger btn-sm" disabled={busy} onClick={onCancel}>Cancel spot</button>
          </div>
        ) : (
          <button className="mt-3 w-full text-center text-xs font-semibold text-zinc-400 underline-offset-4 hover:text-white hover:underline" onClick={() => setConfirm(true)}>
            Can&apos;t make it? Cancel registration
          </button>
        )}
      </div>
    </section>
  );
}

/** Pending, waitlisted or declined. */
export function RegistrationStatusCard({ status, onLeave, busy }: { status: "pending" | "waitlist" | "declined"; onLeave: () => void; busy: boolean }) {
  const c = {
    pending: { emoji: "⏳", eyebrow: "Request sent", title: "Waiting for host approval", body: "The host reviews every request. We'll let you know here and by email the moment they decide.", leave: "Withdraw request", tone: "bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100" },
    waitlist: { emoji: "🪑", eyebrow: "On the waitlist", title: "You're on the waitlist", body: "The room is full for now. If a spot frees up you'll be moved in automatically and we'll tell you.", leave: "Leave waitlist", tone: "bg-sky-100 text-sky-950 dark:bg-sky-400/15 dark:text-sky-100" },
    declined: { emoji: "🙏", eyebrow: "Not this time", title: "The host couldn't fit you in", body: "Thanks for your interest. Follow the host for their next event, there's always another meetup.", leave: "", tone: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200" },
  }[status];
  return (
    <section id="checkin" className={cn(card, c.tone)}>
      <div className="flex items-start gap-4">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-2xl dark:bg-white/10">{c.emoji}</span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] opacity-70">{c.eyebrow}</p>
          <h2 className="mt-0.5 text-2xl font-extrabold leading-tight">{c.title}</h2>
          <p className="mt-1 text-sm opacity-80">{c.body}</p>
          {c.leave && <button className="btn-secondary btn-sm mt-4" disabled={busy} onClick={onLeave}>{c.leave}</button>}
        </div>
      </div>
    </section>
  );
}

export function CancelledBanner({ reason }: { reason: string | null }) {
  return (
    <section role="status" className="relative overflow-hidden rounded-[2rem] bg-red-50 p-6 text-red-950 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-900/60">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-red-600 dark:text-red-400">Cancelled</p>
      <h2 className="mt-1 text-2xl font-extrabold">This event has been cancelled</h2>
      <p className="mt-1 text-sm">{reason ? <>A note from the host: &ldquo;{reason}&rdquo;</> : "The host called it off. Sorry about that! Registrations and check-ins are closed."}</p>
    </section>
  );
}

/** "Hosted by" avatars linking to profiles. */
export function HostsRow({ hosts }: { hosts: HostPerson[] }) {
  if (!hosts.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Hosted by</span>
      {hosts.map((h) => (
        <Link key={h.id} href={`/u/${h.username}`} className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold ring-1 ring-zinc-200 transition hover:ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-600">
          <Avatar src={h.avatar_url} name={h.name || h.username} size={24} />
          {h.name || `@${h.username}`}
        </Link>
      ))}
    </div>
  );
}

/** Messages the host sent to guests (audience filtered by RLS), live. */
export function HostUpdates({ eventId, signedIn }: { eventId: string; signedIn: boolean }) {
  const supabase = createClient();
  const [msgs, setMsgs] = useState<EventMessage[] | null>(null);
  const [seen, setSeen] = useState<number>(0);
  const [open, setOpen] = useState<string | null>(null);
  const key = `cmi-updates-seen-${eventId}`;

  useEffect(() => {
    if (!signedIn) return;
    try { setSeen(Number(localStorage.getItem(key) ?? 0)); } catch {}
    const load = async () => {
      const { data } = await supabase.from("event_messages").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(20);
      setMsgs((data ?? []) as EventMessage[]);
    };
    load();
    const ch = supabase.channel(`event-msgs:${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` }, load)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, eventId, signedIn, key]);

  // Mark as seen a moment after they render.
  useEffect(() => {
    if (!msgs?.length) return;
    const t = setTimeout(() => { try { localStorage.setItem(key, String(Date.now())); } catch {} }, 4000);
    return () => clearTimeout(t);
  }, [msgs, key]);

  if (!msgs?.length) return null;
  return (
    <section aria-label="Updates from the host" className="card overflow-hidden">
      <header className="flex items-center gap-2 px-5 pb-2 pt-4">
        <span aria-hidden className="text-lg">📣</span>
        <h2 className="text-lg font-extrabold">Updates from the host</h2>
      </header>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {msgs.map((m) => {
          const isNew = new Date(m.created_at).getTime() > seen;
          const expanded = open === m.id || msgs.length === 1;
          return (
            <li key={m.id}>
              <button className="w-full px-5 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40" onClick={() => setOpen(expanded && msgs.length > 1 ? null : m.id)} aria-expanded={expanded}>
                <div className="flex items-center gap-2">
                  {isNew && <span className="chip bg-lime-300 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-900">New</span>}
                  <p className="min-w-0 flex-1 truncate font-bold">{m.subject}</p>
                  <span className="shrink-0 text-xs text-zinc-500">{timeAgo(m.created_at)}</span>
                </div>
                <p className={cn("mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400", !expanded && "line-clamp-2")}>{m.body}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
