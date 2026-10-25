"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import type { EventRow, Profile, ProjectWithRelations, JoinRequest, RegistrationStatus } from "@/lib/types";
import { LOOKING_FOR, SKILLS, STAGES } from "@/lib/constants";
import { cn, eventStatus, needsMySkills, openSlots, directionsHref } from "@/lib/utils";
import { browserTimeZone, fmtInZone, fmtRangeInZone, tzLabel, utcToZoned } from "@/lib/time";
import { ProjectCard, ProjectCardSkeleton } from "@/components/ProjectCard";
import { Avatar } from "@/components/ui/Avatar";
import { EventMedia } from "@/components/EventMedia";
import { StatusBadge } from "@/components/ui/Badges";
import { Field } from "@/components/ui/Form";
import { Sheet } from "./Sheet";
import { Confetti } from "./Confetti";
import { ChipSelect, EmptyState, FilterChip, Icon, ProjectLogo, SectionTitle, TabBar } from "./ui";
import { useEventData, type Attendee } from "./useEventData";
import { CancelledBanner, HostsRow, HostUpdates, RegisterCta, RegisterSheet, RegistrationStatusCard, TicketCard, type HostPerson, type PublicStats } from "./Registration";
import { notify } from "./notify";

type Sponsor = { id: string; name: string; logo_url: string | null; url: string | null; tier: string };
type Tab = "projects" | "people" | "activity";
const LOOKING_LABEL: Record<string, string> = Object.fromEntries(LOOKING_FOR.map((l) => [l.value, l.label]));

export function EventView({ event, profile, initialCheckin, hasTicket: initialHasTicket, justPaid, highlightCheckin = false, sponsors, initialRegistration = null, hosts = [], isHost: isHostProp, initialStats = null }: {
  event: EventRow; profile: Profile | null; initialCheckin: { location_note: string | null } | null;
  hasTicket: boolean; justPaid: boolean; highlightCheckin?: boolean; sponsors: Sponsor[];
  initialRegistration?: RegistrationStatus | null; hosts?: HostPerson[]; isHost?: boolean; initialStats?: PublicStats | null;
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const status = eventStatus(event);
  const ended = status === "ended";
  const cancelled = status === "cancelled";
  const live = status === "live";
  const startsSoon = status === "upcoming" && new Date(event.starts_at).getTime() - Date.now() < 2 * 3600e3;
  const isOrganizer = isHostProp ?? profile?.id === event.organizer_id;
  const [checkin, setCheckin] = useState(initialCheckin);
  const [registration, setRegistration] = useState<RegistrationStatus | null>(initialRegistration);
  const [stats, setStats] = useState<PublicStats | null>(initialStats);
  const checkedIn = !!checkin;
  const canViewBoard = event.visibility === "public" || checkedIn || isOrganizer;
  const { projects, people, reload } = useEventData(event.id, canViewBoard);
  const [tab, setTab] = useState<Tab>("projects");
  const [bringOpen, setBringOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [freshTicket, setFreshTicket] = useState(false);
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [confirming, setConfirming] = useState(justPaid && !initialHasTicket);
  const checkinRef = useRef<HTMLDivElement>(null);

  const refreshStats = useCallback(async () => {
    const { data } = await supabase.rpc("event_public_stats", { p_event: event.id });
    const row = (data as PublicStats[] | null)?.[0];
    if (row) setStats(row);
  }, [supabase, event.id]);

  // Count one page view per browser session.
  useEffect(() => {
    const key = `cmi-viewed-${event.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage blocked: still count */ }
    supabase.rpc("track_event_view", { p_event: event.id }).then(() => {}, () => {});
  }, [supabase, event.id]);

  // Hosts approving, waitlist promotions and capacity changes arrive live.
  useEffect(() => {
    if (!profile) return;
    const ch = supabase.channel(`my-reg:${event.id}:${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations", filter: `event_id=eq.${event.id}` }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as { user_id?: string; status?: RegistrationStatus };
        if (row?.user_id === profile.id && row.status) {
          setRegistration((prev) => {
            if (prev !== "going" && row.status === "going") toast("You're in! Your ticket is ready.", { kind: "success" });
            if (prev !== "declined" && row.status === "declined") toast("The host couldn't fit you in this time.");
            return row.status!;
          });
        }
        refreshStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, event.id, profile, toast, refreshStats]);

  // Arrived from "post a project" without checking in: bring the check-in card into view.
  useEffect(() => {
    if (highlightCheckin && !checkedIn) checkinRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightCheckin, checkedIn]);

  // Back from checkout: poll the ticket every 3s for up to 30s while the payment webhook lands.
  useEffect(() => {
    if (!confirming || !profile) return;
    let tries = 0;
    const id = setInterval(async () => {
      tries++;
      const { data } = await supabase.from("event_tickets").select("status").eq("event_id", event.id).eq("user_id", profile.id).maybeSingle();
      if (data?.status === "paid") {
        clearInterval(id);
        setHasTicket(true);
        setConfirming(false);
        toast("Ticket confirmed. You can check in now!", { kind: "success" });
      } else if (tries >= 10) {
        clearInterval(id);
        setConfirming(false);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [confirming, profile, supabase, event.id, toast]);

  const party = () => {
    setCelebrate(true);
    navigator.vibrate?.([30, 40, 30]);
    setTimeout(() => setCelebrate(false), 2200);
  };

  const doCheckin = async () => {
    if (!profile) return;
    setBusy(true);
    const { data, error } = await supabase.from("event_checkins").insert({ event_id: event.id, user_id: profile.id }).select().single();
    setBusy(false);
    if (error) {
      if (error.code === "23505") { setCheckin({ location_note: null }); reload(); return; } // already checked in (another tab)
      if (/register first/i.test(error.message)) setRegisterOpen(true);
      return toast(friendlyCheckinError(error.message), { kind: "error" });
    }
    setCheckin(data);
    setRegistration("going");
    party();
    reload();
    refreshStats();
    setTimeout(() => setBringOpen(true), 900);
  };

  const onRegistered = (st: RegistrationStatus) => {
    setRegisterOpen(false);
    setRegistration(st);
    refreshStats();
    if (st === "going") { party(); setFreshTicket(true); toast("You're on the list! 🎉", { kind: "success" }); }
    else if (st === "pending") toast("Request sent. The host will review it soon.");
    else if (st === "waitlist") toast("You're on the waitlist. We'll tell you if a spot opens.");
  };

  const cancelRegistration = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_registration", { p_event: event.id });
    setBusy(false);
    if (error) return toast(error.message, { kind: "error" });
    setRegistration("cancelled");
    refreshStats();
    toast("Your spot is released. Thanks for letting the host know.");
  };

  const buyTicket = async () => {
    setBusy(true);
    const res = await fetch("/api/tickets/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.url) window.location.href = j.url;
    else toast(j.error || (res.status === 501 ? "Ticket sales aren't set up for this event yet. Ask the organizer to check you in." : "Couldn't start checkout. Try again."), { kind: "error" });
  };

  const needsTicket = event.ticket_price_cents > 0 && !hasTicket && !isOrganizer;
  const price = (event.ticket_price_cents / 100).toLocaleString(undefined, { style: "currency", currency: event.currency.toUpperCase() });

  const highlightPill = highlightCheckin && (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-lime-300 px-3 py-1 text-xs font-bold text-zinc-900">
      👇 Check in first to post your project
    </p>
  );

  const ticketGate = needsTicket ? (
    <div className="mb-3">
      {confirming && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm font-semibold backdrop-blur">
          <span className="h-2 w-2 animate-ping rounded-full bg-lime-300" /> Payment received, confirming your ticket…
        </p>
      )}
      <button className="btn-accent h-14 w-full text-base" disabled={busy || confirming} onClick={buyTicket}>
        <Icon name="ticket" className="h-5 w-5" /> {busy ? "Opening checkout…" : `Get a ticket · ${price}`}
      </button>
      {justPaid && !confirming && (
        <button className="btn mt-2 w-full bg-white/15 text-white hover:bg-white/25" disabled={busy} onClick={doCheckin}>I&apos;ve paid, check me in</button>
      )}
    </div>
  ) : undefined;

  return (
    <div className="space-y-5">
      <EventHeader event={event} status={status} people={people} isOrganizer={isOrganizer} stats={stats} hosts={hosts} />

      {cancelled && <CancelledBanner reason={event.cancel_reason} />}

      {ended && (
        <div role="status" className="flex items-start gap-3 rounded-3xl bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
          <span aria-hidden className="text-xl">🌙</span>
          <p><b>That&apos;s a wrap.</b> The board is read-only now and stays up for 7 days so you can follow up with people.</p>
        </div>
      )}

      {/* Registration and check-in */}
      {!cancelled && (
        <div ref={checkinRef} className="relative">
          {celebrate && <Confetti />}
          {!profile ? (
            !ended && (
              <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 text-white dark:ring-1 dark:ring-zinc-800">
                <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-600/40 blur-3xl" />
                <p className="eyebrow !text-lime-300">You&apos;re invited</p>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight">Join the room, find your people.</h2>
                <p className="mt-2 text-sm text-zinc-300">
                  Sign in to {live ? "check in" : event.require_approval ? "request a spot" : "register"}, show what you&apos;re building and team up with folks here.
                </p>
                <Link href={`/login?next=/e/${event.code}`} className="btn-accent mt-5 w-full">Sign in to {live ? "check in" : "register"}</Link>
              </section>
            )
          ) : checkedIn ? (
            <CheckedInPanel eventId={event.id} userId={profile.id} note={checkin?.location_note ?? null} ended={ended} fresh={celebrate}
              onNote={(n) => setCheckin({ location_note: n })} onBring={() => setBringOpen(true)} code={event.code} />
          ) : ended ? null : registration === "going" || isOrganizer ? (
            <TicketCard event={event} userId={profile.id} live={live} soon={startsSoon} busy={busy} fresh={freshTicket}
              onCheckin={doCheckin} onCancel={cancelRegistration} ticketGate={ticketGate} />
          ) : registration === "pending" || registration === "waitlist" || registration === "declined" ? (
            <RegistrationStatusCard status={registration} busy={busy} onLeave={cancelRegistration} />
          ) : needsTicket && live ? (
            <section id="checkin" className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-brand to-fuchsia-700 p-6 text-white">
              <div className="relative">
                {highlightPill}
                <p className="eyebrow !text-lime-300">Ticket required</p>
                <h2 className="mt-1 text-3xl font-extrabold">Grab your spot</h2>
                <p className="mb-5 mt-1 text-sm text-violet-100">One ticket, the whole room. Checkout takes a minute.</p>
                {ticketGate}
              </div>
            </section>
          ) : (
            <RegisterCta event={event} stats={stats} live={live} busy={busy} highlight={highlightCheckin}
              onRegister={() => setRegisterOpen(true)} onCheckin={doCheckin}>
              {highlightPill}
            </RegisterCta>
          )}
        </div>
      )}

      {!cancelled && <HostUpdates eventId={event.id} signedIn={!!profile} />}

      {sponsors.length > 0 && (
        <section aria-label="Sponsors" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Made possible by</span>
          {sponsors.map((s) => (
            <a key={s.id} href={s.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 text-sm font-semibold ring-1 ring-zinc-200 transition hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800">
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="" className="h-6 w-6 rounded-full object-contain" />
              ) : <ProjectLogo name={s.name} url={null} size={24} className="rounded-full" />}
              {s.name}
            </a>
          ))}
        </section>
      )}

      {cancelled ? null : !canViewBoard ? (
        <EmptyState emoji="🔒" title="The board is for people in the room" body={live ? "Check in above and you'll see every project and person here, live." : "Once the event starts, check in at the venue to see every project and person in the room."} />
      ) : (
        <>
          <div className="sticky top-14 z-30 -mx-4 bg-zinc-50/85 px-4 py-2 backdrop-blur-md dark:bg-zinc-950/85">
            <TabBar
              label="Event sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "projects", label: "Projects", count: projects?.length ?? null },
                { value: "people", label: "People", count: people?.length ?? null },
                { value: "activity", label: "My activity" },
              ]}
            />
          </div>
          <div key={tab} className="animate-rise">
            {tab === "projects" && <ProjectsTab projects={projects} people={people} profile={profile} code={event.code} checkedIn={checkedIn} ended={ended} onPost={() => setBringOpen(true)} onPeople={() => setTab("people")} />}
            {tab === "people" && <PeopleTab people={people} profile={profile} event={event} ended={ended} checkedIn={checkedIn} />}
            {tab === "activity" && (profile ? <ActivityTab eventId={event.id} code={event.code} profile={profile} projects={projects} /> : <EmptyState emoji="👀" title="Sign in to see your activity" />)}
          </div>
        </>
      )}

      {profile && <BringProjectSheet open={bringOpen} onClose={() => setBringOpen(false)} eventId={event.id} code={event.code} userId={profile.id} onAdded={reload} />}
      {profile && !cancelled && <RegisterSheet open={registerOpen} onClose={() => setRegisterOpen(false)} event={event} onDone={onRegistered} />}
    </div>
  );
}

function EventHeader({ event, status, people, isOrganizer, stats, hosts }: {
  event: EventRow; status: string; people: Attendee[] | null; isOrganizer: boolean; stats: PublicStats | null; hosts: HostPerson[];
}) {
  const { toast } = useApp();
  const [more, setMore] = useState(false);
  const [viewerTime, setViewerTime] = useState<string | null>(null);
  const tz = event.timezone || "UTC";
  // Only after mount: the viewer's zone isn't known on the server.
  useEffect(() => {
    const mine = browserTimeZone();
    if (mine !== tz && utcToZoned(event.starts_at, mine).time !== utcToZoned(event.starts_at, tz).time) {
      setViewerTime(fmtInZone(event.starts_at, mine) + " " + tzLabel(event.starts_at, mine));
    }
  }, [event.starts_at, tz]);
  const showGuests = event.show_guest_list !== false || isOrganizer;
  const faces = showGuests ? (people ?? []).slice(0, 5) : [];
  const longDesc = (event.description ?? "").length > 240;
  const spotsLeft = event.capacity ? (stats?.spots_left ?? null) : null;
  const live = status === "live";
  const headcount = stats ? (live || status === "ended" ? Number(stats.checked_in) : Number(stats.going)) : people?.length ?? 0;
  const directions = directionsHref(event);
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/e/${event.code}`); toast("Event link copied"); } catch { /* clipboard blocked */ }
  };

  return (
    <header className="space-y-4">
      <EventMedia event={event} className="shadow-[0_20px_50px_-25px_rgba(0,0,0,.45)]" />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "live" ? (
            <span className="chip bg-red-500 text-white"><span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />Live now</span>
          ) : status === "ended" ? (
            <span className="chip bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Ended</span>
          ) : status === "cancelled" ? (
            <span className="chip bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200">Cancelled</span>
          ) : (
            <span className="chip bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">Upcoming</span>
          )}
          <button onClick={copyCode} className="chip bg-zinc-900 font-mono tracking-widest text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900" aria-label={`Event code ${event.code}, copy link`}>
            {event.code} <Icon name="copy" className="h-3 w-3" />
          </button>
          {event.visibility === "invite_only" && <span className="chip bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200">Invite-only</span>}
          {event.require_approval && <span className="chip bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">Approval required</span>}
        </div>
        <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">{event.name}</h1>
        <div className="mt-3 flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="flex items-start gap-2">
            <Icon name="calendar" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {fmtRangeInZone(event.starts_at, event.ends_at, tz)}
              {viewerTime && <span className="block text-xs text-zinc-500">Your time: {viewerTime}</span>}
            </span>
          </span>
          {(event.venue || event.city) && (
            directions ? (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline decoration-zinc-300 underline-offset-4 hover:text-brand hover:decoration-brand dark:decoration-zinc-700 dark:hover:text-violet-300">
                <Icon name="pin" className="h-4 w-4 shrink-0" />{[event.venue, event.city].filter(Boolean).join(", ")}
              </a>
            ) : (
              <span className="flex items-center gap-2"><Icon name="pin" className="h-4 w-4 shrink-0" />{[event.venue, event.city].filter(Boolean).join(", ")}</span>
            )
          )}
        </div>

        {status !== "cancelled" && (directions || event.location_details) && (
          <div className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="flex items-start gap-3 p-4">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-zinc-900"><Icon name="pin" className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Getting there</p>
                <p className="font-bold leading-snug">{[event.venue, event.city].filter(Boolean).join(", ") || "Venue location"}</p>
                {event.location_details && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{event.location_details}</p>}
              </div>
            </div>
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] items-center justify-center gap-2 border-t border-zinc-200 text-sm font-bold text-brand transition hover:bg-violet-50 dark:border-zinc-800 dark:text-violet-300 dark:hover:bg-violet-950/30">
                Get directions in Google Maps <span aria-hidden>↗</span>
              </a>
            )}
          </div>
        )}

        {hosts.length > 0 && <div className="mt-4"><HostsRow hosts={hosts} /></div>}

        {status !== "cancelled" && ((showGuests && (headcount > 0 || faces.length > 0)) || spotsLeft !== null) ? (
          <div className="mt-4 flex items-center gap-3">
            {faces.length > 0 && (
              <div className="flex -space-x-2">
                {faces.map((a) => (
                  <span key={a.user_id} className="rounded-full ring-[3px] ring-zinc-50 dark:ring-zinc-950"><Avatar src={a.profile.avatar_url} name={a.profile.name.split(" ")[0] ?? ""} size={32} /></span>
                ))}
              </div>
            )}
            <p className="text-sm">
              {showGuests && (
                <>
                  <b className="font-display text-base">{headcount}</b>{" "}
                  <span className="text-zinc-600 dark:text-zinc-400">{live || status === "ended" ? (headcount === 1 ? "builder here" : "builders here") : "going"}</span>
                  {stats && Number(stats.waitlist) > 0 && <span className="text-zinc-600 dark:text-zinc-400"> · {stats.waitlist} on the waitlist</span>}
                </>
              )}
              {spotsLeft !== null && <span className="text-zinc-600 dark:text-zinc-400">{showGuests ? " · " : ""}{spotsLeft === 0 ? "Full" : `${spotsLeft} of ${event.capacity} spots left`}</span>}
            </p>
          </div>
        ) : null}
        {status !== "cancelled" && spotsLeft !== null && event.capacity && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-fuchsia-500" style={{ width: `${Math.min(100, ((event.capacity - spotsLeft) / event.capacity) * 100)}%` }} />
          </div>
        )}

        {event.description && (
          <div className="mt-4">
            <p className={cn("whitespace-pre-line text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300", !more && longDesc && "line-clamp-3")}>{event.description}</p>
            {longDesc && <button className="mt-1 text-sm font-bold text-brand dark:text-violet-300" onClick={() => setMore(!more)}>{more ? "Show less" : "Read more"}</button>}
          </div>
        )}

        {isOrganizer && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn-secondary btn-sm" href={`/organizer/${event.id}`}>Manage event</Link>
            <Link className="btn-secondary btn-sm" href={`/e/${event.code}/board`} target="_blank">Open Live Board <Icon name="external" className="h-3.5 w-3.5" /></Link>
          </div>
        )}
      </div>
    </header>
  );
}

function CheckedInPanel({ eventId, userId, note, ended, fresh, onNote, onBring, code }: {
  eventId: string; userId: string; note: string | null; ended: boolean; fresh: boolean; onNote: (n: string | null) => void; onBring: () => void; code: string;
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const [val, setVal] = useState(note ?? "");
  const [editing, setEditing] = useState(false);
  const save = async () => {
    const v = val.trim() || null;
    onNote(v); setEditing(false);
    const { error } = await supabase.from("event_checkins").update({ location_note: v }).eq("event_id", eventId).eq("user_id", userId);
    if (error) toast(error.message, { kind: "error" });
    else toast(v ? "Saved. Founders can find you now." : "Location cleared");
  };
  return (
    <section className={cn("rounded-[2rem] bg-lime-200 p-5 text-zinc-900 shadow-[0_6px_0_0_#a3e635] dark:bg-lime-300", fresh && "animate-pop")}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-xl text-lime-300">✓</span>
        <div>
          <p className="font-display text-xl font-extrabold leading-tight">{fresh ? "You're on the board!" : "You're checked in"}</p>
          <p className="text-sm text-zinc-700">People can now find you and your projects.</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/70 p-3">
        {editing ? (
          <div className="flex gap-2">
            <input className="input !bg-white" maxLength={80} autoFocus placeholder="Table 4, blue shirt" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Where can people find you?" onKeyDown={(e) => e.key === "Enter" && save()} />
            <button className="btn-primary shrink-0" onClick={save}>Save</button>
          </div>
        ) : (
          <button className="flex w-full items-center gap-3 text-left" onClick={() => setEditing(true)}>
            <Icon name="pin" className="h-5 w-5 shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{note || "Where can people find you?"}</span>
              <span className="block text-xs text-zinc-600">{note ? "Tap to edit. Shared only after you say “Let's talk”." : "Shared only with founders you say “Let's talk” to."}</span>
            </span>
            <span className="text-xs font-bold text-brand">{note ? "Edit" : "Add"}</span>
          </button>
        )}
      </div>

      {!ended && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={onBring}>Bring a project</button>
          <Link className="btn bg-zinc-900 text-white shadow-[0_4px_0_0_#000] hover:-translate-y-px active:shadow-none" href={`/me/projects/new?event=${code}`}>Post new</Link>
        </div>
      )}
    </section>
  );
}

function BringProjectSheet({ open, onClose, eventId, code, userId, onAdded }: { open: boolean; onClose: () => void; eventId: string; code: string; userId: string; onAdded: () => void }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [mine, setMine] = useState<{ id: string; name: string; pitch: string; logo_url: string | null }[] | null>(null);
  const [here, setHere] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: p }, { data: ep }] = await Promise.all([
        supabase.from("projects").select("id,name,pitch,logo_url").eq("owner_id", userId).order("created_at", { ascending: false }),
        supabase.from("event_projects").select("project_id").eq("event_id", eventId),
      ]);
      setMine(p ?? []);
      setHere(new Set((ep ?? []).map((r: { project_id: string }) => r.project_id)));
    })();
  }, [open, supabase, userId, eventId]);

  const toggle = async (id: string) => {
    const on = here.has(id);
    const next = new Set(here);
    if (on) next.delete(id); else next.add(id);
    setHere(next); // optimistic
    const { error } = on
      ? await supabase.from("event_projects").delete().eq("event_id", eventId).eq("project_id", id)
      : await supabase.from("event_projects").insert({ event_id: eventId, project_id: id });
    if (error) { toast(error.message, { kind: "error" }); setHere(here); }
    else { if (!on) toast("Your project is on the board! 🚀", { kind: "success" }); onAdded(); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Bring a project" subtitle="Tap to show it on tonight's board. Tap again to take it down.">
      {mine === null ? (
        <div className="space-y-2"><div className="skeleton h-[72px] rounded-2xl" /><div className="skeleton h-[72px] rounded-2xl" /></div>
      ) : (
        <div className="space-y-2.5">
          {mine.length === 0 && (
            <EmptyState emoji="🚀" title="Nothing to bring yet" body="Post your first project. It takes about a minute and you can reuse it at every event." className="py-8" />
          )}
          {mine.map((p) => {
            const on = here.has(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={on}
                className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-inset transition",
                  on ? "bg-violet-50 ring-2 ring-brand dark:bg-violet-950/40 dark:ring-violet-400" : "bg-zinc-50 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-800/50 dark:ring-zinc-700")}>
                <ProjectLogo name={p.name} url={p.logo_url} size={44} />
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{p.name}</span><span className="block truncate text-sm text-zinc-600 dark:text-zinc-400">{p.pitch}</span></span>
                <span className={cn("flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-bold transition", on ? "bg-brand text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700")}>
                  {on ? "✓ On board" : "+ Show"}
                </span>
              </button>
            );
          })}
          <Link href={`/me/projects/new?event=${code}`} className="btn-secondary mt-2 w-full">+ Post a new project</Link>
        </div>
      )}
    </Sheet>
  );
}

function ProjectsTab({ projects, people, profile, code, checkedIn, ended, onPost, onPeople }: {
  projects: ProjectWithRelations[] | null; people: Attendee[] | null; profile: Profile | null; code: string; checkedIn: boolean; ended: boolean; onPost: () => void; onPeople: () => void;
}) {
  const mySkills = profile?.skills ?? [];
  const [mineOnly, setMineOnly] = useState(mySkills.length > 0);
  const [specialty, setSpecialty] = useState("");
  const [stage, setStage] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!projects) return null;
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (mineOnly && p.owner_id !== profile?.id && !needsMySkills(p, mySkills)) return false;
      if (specialty && !openSlots(p).some((s) => s.specialty.toLowerCase() === specialty.toLowerCase())) return false;
      if (stage && p.stage !== stage) return false;
      if (openOnly && p.openness === "closed") return false;
      if (openOnly && p.openness === "specific" && openSlots(p).length === 0) return false;
      if (term) {
        const hay = `${p.name} ${p.pitch} ${p.description ?? ""} ${p.tech_stack.join(" ")} ${p.owner?.name ?? ""} ${p.project_slots.map((s) => s.specialty).join(" ")}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [projects, mineOnly, specialty, stage, openOnly, q, mySkills, profile?.id]);

  // Smart match: people here whose skills cover my projects' open slots.
  const smartMatch = useMemo(() => {
    if (!profile || !projects || !people) return 0;
    const needed = new Set(projects.filter((p) => p.owner_id === profile.id).flatMap((p) => openSlots(p).map((s) => s.specialty.toLowerCase())));
    if (!needed.size) return 0;
    return people.filter((a) => a.user_id !== profile.id && a.profile.skills.some((s) => needed.has(s.toLowerCase()))).length;
  }, [profile, projects, people]);

  const anyFilter = mineOnly || openOnly || !!specialty || !!stage || !!q;
  const clear = () => { setMineOnly(false); setSpecialty(""); setStage(""); setOpenOnly(false); setQ(""); };

  return (
    <div className="space-y-4">
      {smartMatch > 0 && (
        <button onClick={onPeople} className="flex w-full items-center gap-3 rounded-3xl bg-zinc-950 p-4 text-left text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-zinc-900">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-xl text-zinc-900">✨</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-extrabold leading-tight">{smartMatch} {smartMatch === 1 ? "person here has" : "people here have"} the skills you need</span>
            <span className="block text-sm opacity-70">Invite them before someone else does</span>
          </span>
          <Icon name="arrow" className="h-5 w-5 shrink-0" />
        </button>
      )}

      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input type="search" className="input pl-11" placeholder="Search projects, stacks, people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {mySkills.length > 0 && <FilterChip on={mineOnly} onClick={() => setMineOnly(!mineOnly)}>✨ Needs my skills</FilterChip>}
        <FilterChip on={openOnly} onClick={() => setOpenOnly(!openOnly)}>🙌 Open only</FilterChip>
        <ChipSelect value={specialty} onChange={setSpecialty} label="Filter by role">
          <option value="">Any role</option>
          {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
        </ChipSelect>
        <ChipSelect value={stage} onChange={setStage} label="Filter by stage">
          <option value="">Any stage</option>
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </ChipSelect>
      </div>

      {filtered && projects && projects.length > 0 && anyFilter && filtered.length > 0 && filtered.length < projects.length && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Showing <b className="text-zinc-900 dark:text-white">{filtered.length}</b> of {projects.length}{mineOnly ? " that need your skills" : ""}.{" "}
          <button className="font-bold text-brand dark:text-violet-300" onClick={clear}>Show all</button>
        </p>
      )}

      {filtered === null ? (
        <div className="grid gap-3 sm:grid-cols-2"><ProjectCardSkeleton /><ProjectCardSkeleton /><ProjectCardSkeleton /><ProjectCardSkeleton /></div>
      ) : projects!.length === 0 ? (
        <EmptyState
          emoji="🌱"
          title="No projects yet. Be the first!"
          body={!checkedIn && !ended ? "Check in above, then put what you're building on the board." : "The first project up always gets the most attention."}
          action={checkedIn && !ended && <button className="btn-primary" onClick={onPost}>Post your project</button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Nothing matches yet"
          body={mineOnly ? `No one here is looking for ${mySkills.slice(0, 3).join(", ")} right now. New projects pop in all night.` : "Try fewer filters."}
          action={<button className="btn-secondary" onClick={clear}>Show everything</button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => <li key={p.id}><ProjectCard p={p} eventCode={code} highlight={p.owner_id === profile?.id} /></li>)}
        </ul>
      )}
    </div>
  );
}

function PeopleTab({ people, profile, event, ended, checkedIn }: { people: Attendee[] | null; profile: Profile | null; event: EventRow; ended: boolean; checkedIn: boolean }) {
  const [skill, setSkill] = useState("");
  const [q, setQ] = useState("");
  const [inviting, setInviting] = useState<Attendee | null>(null);
  const filtered = useMemo(() => {
    if (!people) return null;
    const term = q.trim().toLowerCase();
    return people.filter((a) => {
      if (skill && !a.profile.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return false;
      if (term && !`${a.profile.name} ${a.profile.username} ${a.profile.bio ?? ""} ${a.profile.skills.join(" ")}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [people, skill, q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input type="search" className="input pl-11" placeholder="Search by name, skill or bio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <FilterChip on={!skill} onClick={() => setSkill("")}>Everyone</FilterChip>
        {SKILLS.filter((s) => s !== "Other").map((s) => (
          <FilterChip key={s} on={skill === s} onClick={() => setSkill(skill === s ? "" : s)}>{s}</FilterChip>
        ))}
      </div>
      {filtered === null ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[120px] rounded-3xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState emoji={people!.length ? "🤷" : "🚪"} title={people!.length ? "No one matches" : "No one's checked in yet"} body={people!.length ? "Try another skill." : "Faces will show up here as people arrive."} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => {
            const me = a.user_id === profile?.id;
            return (
              <li key={a.user_id} className="card flex flex-col p-4">
                <Link href={`/u/${a.profile.username}`} className="flex min-w-0 items-center gap-3">
                  <Avatar src={a.profile.avatar_url} name={a.profile.name} size={48} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{a.profile.name || a.profile.username}{me && <span className="ml-1.5 text-xs font-semibold text-brand dark:text-violet-300">you</span>}</span>
                    <span className="block truncate text-xs text-zinc-500">@{a.profile.username}</span>
                  </span>
                </Link>
                {a.profile.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {a.profile.skills.slice(0, 3).map((s) => <span key={s} className="chip bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{s}</span>)}
                    {a.profile.skills.length > 3 && <span className="chip text-zinc-500">+{a.profile.skills.length - 3}</span>}
                  </div>
                )}
                {a.profile.looking_for?.length > 0 && (
                  <p className="mt-2 truncate text-xs text-zinc-600 dark:text-zinc-400"><span className="font-semibold text-violet-700 dark:text-violet-300">Up for:</span> {a.profile.looking_for.map((l) => LOOKING_LABEL[l] ?? l).join(", ")}</p>
                )}
                {profile && checkedIn && !me && !ended && (
                  <button className="btn-secondary btn-sm mt-3 w-full" onClick={() => setInviting(a)}>Invite to my project</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {profile && inviting && <InviteSheet attendee={inviting} profile={profile} event={event} onClose={() => setInviting(null)} />}
    </div>
  );
}

function InviteSheet({ attendee, profile, event, onClose }: { attendee: Attendee; profile: Profile; event: EventRow; onClose: () => void }) {
  const eventId = event.id;
  const supabase = createClient();
  const { toast } = useApp();
  const [mine, setMine] = useState<ProjectWithRelations[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("*, project_slots(*)").eq("owner_id", profile.id).neq("openness", "closed").order("created_at", { ascending: false })
      .then(({ data }: { data: ProjectWithRelations[] | null }) => {
        setMine(data ?? []);
        if (data?.[0]) setProjectId(data[0].id);
      });
  }, [supabase, profile.id]);

  const project = mine?.find((p) => p.id === projectId);
  const slots = project ? openSlots(project) : [];
  const name = attendee.profile.name || attendee.profile.username;

  const send = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_join_request", {
      p_project: projectId, p_slot: slotId || null, p_event: eventId, p_message: message || null, p_candidate: attendee.user_id,
    });
    setBusy(false);
    if (error) return toast(error.message, { kind: "error" });
    notify(data as string);
    toast(`Invite sent to ${name} ✉️`, { kind: "success" });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`Invite ${name}`} subtitle={attendee.profile.skills.slice(0, 4).join(" · ") || undefined}>
      {mine === null ? <div className="skeleton h-40 rounded-2xl" /> : mine.length === 0 ? (
        <EmptyState emoji="📣" title="You need an open project first" body="Invites go to projects that are open to collaborators." className="py-8"
          action={<Link className="btn-primary" href={`/me/projects/new?event=${event.code}`}>Post a project</Link>} />
      ) : (
        <div className="space-y-4">
          <Field label="Project" htmlFor="inv-proj">
            <select id="inv-proj" className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSlotId(""); }}>
              {mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Role" htmlFor="inv-slot">
            <select id="inv-slot" className="input" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">General collaborator</option>
              {slots.map((s) => <option key={s.id} value={s.id}>{s.specialty}</option>)}
            </select>
          </Field>
          <Field label="Message" optional htmlFor="inv-msg" counter={{ value: message.length, max: 280 }}>
            <textarea id="inv-msg" className="input" rows={3} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Why you'd love to build with ${name.split(" ")[0]}`} />
          </Field>
          <button className="btn-primary w-full" disabled={busy || !projectId} onClick={send}>{busy ? "Sending…" : "Send invite"}</button>
        </div>
      )}
    </Sheet>
  );
}

type ReqWithProject = JoinRequest & { project: { id: string; name: string } | null; slot: { specialty: string } | null };

function ActivityTab({ eventId, code, profile, projects }: { eventId: string; code: string; profile: Profile; projects: ProjectWithRelations[] | null }) {
  const supabase = createClient();
  const [mine, setMine] = useState<ReqWithProject[] | null>(null);
  const [pending, setPending] = useState<Record<string, number>>({});
  const myProjects = useMemo(() => (projects ?? []).filter((p) => p.owner_id === profile.id), [projects, profile.id]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("join_requests").select("*, project:projects(id,name), slot:project_slots(specialty)")
      .eq("requester_id", profile.id).eq("event_id", eventId).order("created_at", { ascending: false });
    setMine((data ?? []) as ReqWithProject[]);
    if (myProjects.length) {
      const { data: r } = await supabase.from("join_requests").select("project_id")
        .in("project_id", myProjects.map((p) => p.id)).eq("direction", "request").eq("status", "pending");
      const counts: Record<string, number> = {};
      (r ?? []).forEach((x: { project_id: string }) => { counts[x.project_id] = (counts[x.project_id] ?? 0) + 1; });
      setPending(counts);
    }
  }, [supabase, profile.id, eventId, myProjects]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`activity:${eventId}:${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, load, eventId, profile.id]);

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>My projects here</SectionTitle>
        {myProjects.length === 0 ? (
          <p className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">You haven&apos;t brought a project tonight. Founders with a project on the board get way more conversations.</p>
        ) : (
          <ul className="space-y-2">
            {myProjects.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}?e=${code}`} className="card flex items-center gap-3 p-3 transition hover:ring-violet-300">
                  <ProjectLogo name={p.name} url={p.logo_url} size={40} />
                  <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                  {pending[p.id] ? <span className="chip bg-brand text-white">{pending[p.id]} waiting</span> : <span className="text-xs text-zinc-500">No requests yet</span>}
                  <Icon name="arrow" className="h-4 w-4 text-zinc-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <SectionTitle>My requests &amp; invites</SectionTitle>
        {mine === null ? <div className="skeleton h-16 rounded-2xl" /> : mine.length === 0 ? (
          <p className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">Nothing yet. Find a project you like and tap &ldquo;Count me in&rdquo;.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={r.status === "accepted" ? `/space/${r.project_id}` : `/p/${r.project_id}?e=${code}`} className="card flex items-center justify-between gap-3 p-3 transition hover:ring-violet-300">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{r.project?.name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {r.direction === "invite" ? "Invited you" : "You asked"}{r.slot ? ` · ${r.slot.specialty}` : ""}
                      {r.status === "pending" && r.direction === "invite" ? " · reply in Inbox" : ""}
                      {r.status === "accepted" ? " · open project space" : ""}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function friendlyCheckinError(msg: string) {
  if (/waiting for host approval|waitlist|declined|register first|requires host approval|registration is closed|cancelled/i.test(msg)) return msg.endsWith(".") ? msg : `${msg}.`;
  if (/capacity/i.test(msg)) return "Sorry, this event is full.";
  if (/invite-only/i.test(msg)) return "This event is invite-only and your email isn't on the guest list.";
  if (/ticket/i.test(msg)) return "You need a ticket to check in.";
  if (/ended/i.test(msg)) return "This event has already ended.";
  if (/row-level security/i.test(msg)) return "You don't have access to check in to this event.";
  return msg;
}
