"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Field, FormSection, Segmented } from "@/components/ui/Form";
import { EventForm } from "./EventForm";
import { cn, eventStatus } from "@/lib/utils";
import { fmtRangeInZone } from "@/lib/time";
import type { EventMessage, EventRow } from "@/lib/types";
import { countGuests, type Guest, type GuestFilter, type GuestProfile } from "./host/core";
import { useGuests } from "./host/guests";
import { HIcon, StatTile } from "./host/ui";
import { GuestsPanel } from "./host/GuestsPanel";
import { MessagesPanel } from "./host/MessagesPanel";
import { InsightsPanel, type Insights } from "./host/InsightsPanel";
import { TeamPanel, type HostRow } from "./host/TeamPanel";
import { LifecyclePanel } from "./host/LifecyclePanel";

type Stats = { attendees: number; projects: number; requests: number; matches: number; open_slots: number } | null;
type Sponsor = { id: string; name: string; logo_url: string | null; url: string | null; tier: string };
type Tab = "overview" | "guests" | "messages" | "insights" | "team" | "settings";

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: "overview", label: "Overview", icon: "home" },
  { value: "guests", label: "Guests", icon: "users" },
  { value: "messages", label: "Messages", icon: "mail" },
  { value: "insights", label: "Insights", icon: "chart" },
  { value: "team", label: "Team", icon: "users" },
  { value: "settings", label: "Settings", icon: "settings" },
];

const TIERS = [
  { value: "headline", label: "Headline" },
  { value: "gold", label: "Gold" },
  { value: "supporter", label: "Supporter" },
];

const TIER_STYLE: Record<string, string> = {
  headline: "bg-lime-300 text-zinc-900",
  gold: "bg-amber-200 text-amber-950",
  supporter: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

export function StatusPill({ status }: { status: string }) {
  if (status === "live") {
    return (
      <span className="chip bg-red-500 text-white">
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-white" aria-hidden /> Live
      </span>
    );
  }
  if (status === "cancelled") return <span className="chip bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">Cancelled</span>;
  if (status === "upcoming") return <span className="chip bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200">Upcoming</span>;
  return <span className="chip bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Ended</span>;
}

function ActionTile({ icon, label, sub, href, onClick, external, download, disabled, tone = "default" }: {
  icon: string; label: string; sub?: string; href?: string; onClick?: () => void; external?: boolean; download?: string; disabled?: boolean;
  tone?: "default" | "brand";
}) {
  const cls = cn(
    "group flex min-h-[88px] flex-col justify-between gap-2 rounded-2xl p-3.5 text-left ring-1 ring-inset transition hover:-translate-y-0.5 active:translate-y-0",
    tone === "brand"
      ? "bg-brand text-white ring-brand shadow-[0_4px_0_0_#4c1d95]"
      : "bg-white ring-zinc-200 shadow-[0_3px_0_0_#e4e4e7] hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:shadow-[0_3px_0_0_#27272a]",
    disabled && "pointer-events-none opacity-50"
  );
  const body = (
    <>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone === "brand" ? "bg-white/15" : "bg-violet-50 text-brand dark:bg-violet-950/60 dark:text-violet-300")}>
        <HIcon name={icon} />
      </span>
      <span>
        <span className="block text-sm font-bold leading-tight">{label}{external && <span aria-hidden> ↗</span>}</span>
        {sub && <span className={cn("block text-xs", tone === "brand" ? "text-violet-100" : "text-zinc-500 dark:text-zinc-400")}>{sub}</span>}
      </span>
    </>
  );
  if (href) {
    return external || download ? (
      <a href={href} className={cls} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} download={download}>{body}</a>
    ) : (
      <Link href={href} className={cls}>{body}</Link>
    );
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{body}</button>;
}

export function EventManager(props: {
  event: EventRow; userId: string; isOwner: boolean; owner: Pick<GuestProfile, "id" | "name" | "username" | "avatar_url"> | null;
  eventUrl: string; qr: string; stats: Stats; guests: Guest[]; invites: string[]; sponsors: Sponsor[];
  series: { id: string; name: string }[]; hosts: HostRow[]; messages: EventMessage[]; insights: Insights | null;
}) {
  const { event, userId, isOwner, eventUrl, qr, stats } = props;
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const [tab, setTabState] = useState<Tab>("overview");
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [invites, setInvites] = useState(props.invites.join("\n"));
  const [sponsors, setSponsors] = useState(props.sponsors);
  const [sp, setSp] = useState<{ name: string; url: string; logo_url: string | null; tier: string }>({ name: "", url: "", logo_url: null, tier: "supporter" });
  const [busy, setBusy] = useState(false);
  const [regOpen, setRegOpen] = useState(event.registration_open);
  const { guests, setGuests, refresh } = useGuests(event.id, props.guests);
  const counts = useMemo(() => countGuests(guests), [guests]);
  const st = eventStatus(event);
  const tz = event.timezone || "UTC";
  const photoCount = (event.cover_url ? 1 : 0) + (event.gallery_urls?.length ?? 0);

  // Deep links like ?tab=guests survive reloads.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && TABS.some((x) => x.value === t)) setTabState(t);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    if (t === "overview") url.searchParams.delete("tab"); else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openGuests = (f: GuestFilter) => { setFilter(f); setTab("guests"); };

  const setStatus = async (status: "live" | "ended") => {
    if (status === "ended" && !confirm("End this event? The board becomes read-only.")) return;
    const patch: Partial<EventRow> = { status };
    if (status === "live" && new Date(event.starts_at) > new Date()) patch.starts_at = new Date().toISOString();
    if (status === "ended" && new Date(event.ends_at) > new Date()) {
      // ends_at must stay after starts_at, so pull the start back when ending an event that hasn't started.
      const now = Date.now();
      patch.ends_at = new Date(now).toISOString();
      if (new Date(event.starts_at).getTime() >= now) patch.starts_at = new Date(now - 60_000).toISOString();
    }
    const { error } = await supabase.from("events").update(patch).eq("id", event.id);
    if (error) toast(error.message, { kind: "error" });
    else { toast(status === "live" ? "You're live. Doors open!" : "Event ended"); router.refresh(); }
  };

  const toggleRegistration = async () => {
    const next = !regOpen;
    setRegOpen(next);
    const { error } = await supabase.from("events").update({ registration_open: next }).eq("id", event.id);
    if (error) { setRegOpen(!next); return toast(error.message, { kind: "error" }); }
    toast(next ? "Registration is open" : "Registration closed. Registered guests can still check in.");
  };

  const restore = async () => {
    const { error } = await supabase.rpc("uncancel_event", { p_event: event.id });
    if (error) return toast(error.message, { kind: "error" });
    toast("Event restored", { kind: "success" });
    router.refresh();
  };

  const saveInvites = async () => {
    const emails = Array.from(new Set(invites.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e))));
    setBusy(true);
    await supabase.from("event_invites").delete().eq("event_id", event.id);
    const { error } = emails.length ? await supabase.from("event_invites").insert(emails.map((email) => ({ event_id: event.id, email }))) : { error: null };
    setBusy(false);
    if (error) toast(error.message, { kind: "error" });
    else { setInvites(emails.join("\n")); toast(`${emails.length} invite${emails.length === 1 ? "" : "s"} saved`); }
  };

  const addSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("event_sponsors")
      .insert({ event_id: event.id, name: sp.name.trim(), url: sp.url.trim() || null, logo_url: sp.logo_url, tier: sp.tier })
      .select().single();
    if (error) return toast(error.message, { kind: "error" });
    setSponsors((s) => [...s, data]);
    setSp({ name: "", url: "", logo_url: null, tier: "supporter" });
  };

  const delSponsor = async (id: string) => {
    const { error } = await supabase.from("event_sponsors").delete().eq("id", id);
    if (error) toast(error.message, { kind: "error" });
    else setSponsors((s) => s.filter((x) => x.id !== id));
  };

  const sendRecap = async () => {
    if (!confirm("Send recap emails to all attendees now?")) return;
    setBusy(true);
    const res = await fetch(`/api/events/${event.id}/recap`, { method: "POST" });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.configured === false) toast("Email isn't set up yet. Add RESEND_API_KEY in Vercel to send recaps.", { kind: "error" });
    else if (res.ok) toast(`Recap sent to ${body.sent ?? 0} people`, { kind: "success" });
    else toast(body.error || "Failed to send recap", { kind: "error" });
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast("Link copied"));
  const inviteCount = invites.split(/[\s,;]+/).filter((e) => /.+@.+\..+/.test(e)).length;
  const guestCount = guests.filter((g) => ["going", "pending", "waitlist"].includes(g.status) || g.checked_in_at).length;

  return (
    <div className="space-y-5">
      <Link href="/organizer" className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
        <span aria-hidden>←</span> All events
      </Link>

      {/* Hero: cover, name, status */}
      <section className="card overflow-hidden">
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-fuchsia-500 sm:h-48">
          <div aria-hidden className="dot-grid absolute inset-0 text-white/15" />
          <span aria-hidden className="absolute -bottom-8 -right-6 h-28 w-28 rounded-full bg-lime-300/90" />
          {event.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.cover_url} alt="" className={cn("absolute inset-0 h-full w-full object-cover", st === "cancelled" && "grayscale")} />
          )}
          <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-t to-transparent", event.cover_url ? "from-black/75 via-black/25" : "from-black/30")} />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <StatusPill status={st} />
            {!isOwner && <span className="chip bg-white/90 text-zinc-900">You&apos;re a co-host</span>}
            {photoCount > 0 && (
              <span className="chip bg-black/50 text-white backdrop-blur">
                {photoCount} photo{photoCount === 1 ? "" : "s"}{event.video_url ? " + video" : ""}
              </span>
            )}
          </div>
          <div className="absolute inset-x-4 bottom-4 text-white">
            <h1 className="text-2xl font-extrabold leading-tight drop-shadow sm:text-3xl">{event.name}</h1>
            <p className="mt-1 text-sm text-white/85">
              {fmtRangeInZone(event.starts_at, event.ends_at, tz)}{event.venue ? ` · ${event.venue}` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* Sticky tabs */}
      <nav aria-label="Manage event" className="sticky top-14 z-30 -mx-4 bg-zinc-50/90 px-4 py-2 backdrop-blur dark:bg-zinc-950/90">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100 p-1 [scrollbar-width:none] dark:bg-zinc-800/70 [&::-webkit-scrollbar]:hidden" role="tablist">
          {TABS.map((t) => {
            const on = tab === t.value;
            const badge = t.value === "guests" ? counts.pending : 0;
            return (
              <button
                key={t.value} role="tab" aria-selected={on} onClick={() => setTab(t.value)}
                className={cn("flex min-h-[42px] shrink-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition",
                  on ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")}
              >
                {t.label}
                {badge > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-black text-amber-950 tabular-nums">{badge}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "overview" && (
        <div className="space-y-5">
          {st === "cancelled" ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-zinc-900 p-5 text-white dark:bg-zinc-800">
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold">This event is cancelled</p>
                <p className="mt-1 text-sm text-zinc-300">{event.cancel_reason || "Guests see a cancelled notice on the event page."}</p>
              </div>
              <button className="btn-accent" onClick={restore}>Restore event</button>
            </section>
          ) : st !== "ended" && (
            <section className={cn("flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4", st === "live" ? "bg-red-50 dark:bg-red-950/30" : "bg-lime-100 dark:bg-lime-950/30")}>
              <div>
                <p className="font-bold">{st === "live" ? "The room is live." : "Ready when you are."}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {st === "live" ? "People can check in and send requests. End it when the last pizza slice is gone." : "Start early to open check-in now, or it goes live automatically at start time."}
                </p>
              </div>
              {st === "upcoming" ? (
                <button className="btn-accent" onClick={() => setStatus("live")}>Start now</button>
              ) : (
                <button className="btn-secondary" onClick={() => setStatus("ended")}>End event</button>
              )}
            </section>
          )}

          {counts.pending > 0 && (
            <button
              type="button" onClick={() => openGuests("pending")}
              className="flex w-full items-center gap-3 rounded-3xl bg-amber-100 p-4 text-left ring-1 ring-inset ring-amber-200 transition hover:-translate-y-0.5 dark:bg-amber-950/40 dark:ring-amber-900/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400 font-display text-lg font-extrabold text-amber-950">{counts.pending}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-amber-950 dark:text-amber-100">{counts.pending === 1 ? "1 person is" : `${counts.pending} people are`} waiting for approval</span>
                <span className="block text-sm text-amber-900/80 dark:text-amber-200/80">Review them before they wander off to another meetup.</span>
              </span>
              <span className="font-bold text-amber-950 dark:text-amber-100">Review →</span>
            </button>
          )}

          {/* Registration snapshot */}
          <section aria-label="Registrations" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile label="Going" value={<>{counts.going}{event.capacity ? <span className="text-lg text-zinc-400">/{event.capacity}</span> : null}</>} sub={event.capacity ? `${Math.max(0, event.capacity - counts.going)} spots left` : "No capacity limit"} tone="lime" onClick={() => openGuests("going")} />
            <StatTile label="Checked in" value={counts.checked_in} sub={counts.going ? `${Math.round((counts.checked_in / counts.going) * 100)}% of going` : undefined} tone="brand" onClick={() => openGuests("checked_in")} />
            <StatTile label="Pending" value={counts.pending} sub={event.require_approval ? "Approval is on" : "Approval is off"} tone="amber" onClick={() => openGuests("pending")} />
            <StatTile label="Waitlist" value={counts.waitlist} sub={event.waitlist_enabled ? "Waitlist is on" : "Waitlist is off"} tone="sky" onClick={() => openGuests("waitlist")} />
          </section>

          {/* Registration controls at a glance */}
          {st !== "cancelled" && st !== "ended" && (
            <section className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                <p className="font-bold">Registration is {regOpen ? "open" : "closed"}</p>
                <p className="text-xs text-zinc-500">
                  {[event.require_approval ? "Approval required" : "Instant approval", event.waitlist_enabled ? "waitlist on" : "no waitlist",
                    (event.registration_questions?.length ?? 0) ? `${event.registration_questions.length} question${event.registration_questions.length === 1 ? "" : "s"}` : "no questions",
                    event.show_guest_list ? "guest list public" : "guest list hidden"].join(" · ")}
                </p>
              </div>
              <button className={regOpen ? "btn-secondary btn-sm" : "btn-accent btn-sm"} onClick={toggleRegistration}>{regOpen ? "Close registration" : "Open registration"}</button>
              <button className="btn-ghost btn-sm" onClick={() => setTab("settings")}>Settings</button>
            </section>
          )}

          {/* Door: QR + code */}
          <section className="card grid items-center gap-5 p-5 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto rounded-2xl bg-white p-2 ring-1 ring-zinc-200 sm:mx-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR code for ${eventUrl}`} className="h-36 w-36" />
            </div>
            <div className="text-center sm:text-left">
              <p className="eyebrow">Door code</p>
              <div className="mt-2 flex justify-center gap-1.5 sm:justify-start" aria-label={`Event code ${event.code}`}>
                {event.code.split("").map((ch, i) => (
                  <span key={i} aria-hidden className="flex h-12 w-10 items-center justify-center rounded-xl bg-brand font-mono text-2xl font-bold text-white shadow-[0_3px_0_0_#4c1d95]">{ch}</span>
                ))}
              </div>
              <button type="button" onClick={() => copy(eventUrl)} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                <span className="truncate">{eventUrl.replace(/^https?:\/\//, "")}</span>
                <span className="shrink-0 font-bold text-brand dark:text-violet-300">Copy</span>
              </button>
            </div>
          </section>

          {/* Action grid */}
          <section aria-label="Event actions" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <ActionTile icon="scan" label="Check-in scanner" sub="Scan guest tickets" href={`/organizer/${event.id}/checkin`} tone="brand" />
            <ActionTile icon="board" label="Live Board" sub="Put it on the projector" href={`/e/${event.code}/board`} external />
            <ActionTile icon="poster" label="Door poster" sub="Print-ready A4" href={`/organizer/${event.id}/poster`} external />
            <ActionTile icon="qr" label="Download QR" sub="PNG for slides" href={qr} download={`countmein-${event.code}.png`} />
            <ActionTile icon="eye" label="Attendee view" sub="See what they see" href={`/e/${event.code}`} />
            <ActionTile icon="link" label="Copy link" sub="For chats and socials" onClick={() => copy(eventUrl)} />
            <ActionTile icon="csv" label="Export CSV" sub="Guests and answers" href={`/api/events/${event.id}/export`} download={`countmein-${event.code}.csv`} />
            <ActionTile icon="mail" label="Send recap" sub="Email everyone now" onClick={sendRecap} disabled={busy} />
          </section>

          {stats && (
            <section aria-label="The room">
              <h2 className="mb-3 text-lg font-extrabold">The room</h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatTile label="Matches made" value={stats.matches} tone="lime" />
                <StatTile label="Projects" value={stats.projects} />
                <StatTile label="Requests" value={stats.requests} />
                <StatTile label="Open slots" value={stats.open_slots} />
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "guests" && <GuestsPanel event={event} guests={guests} setGuests={setGuests} refresh={refresh} filter={filter} setFilter={setFilter} />}
      {tab === "messages" && <MessagesPanel event={event} userId={userId} guests={guests} initial={props.messages} />}
      {tab === "insights" && <InsightsPanel event={event} initial={props.insights} />}
      {tab === "team" && <TeamPanel event={event} userId={userId} isOwner={isOwner} owner={props.owner} initial={props.hosts} />}

      {tab === "settings" && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Event details and registration</h2>
            <EventForm userId={userId} series={props.series} event={event} />
          </section>

          {event.visibility === "invite_only" && (
            <FormSection title="Invite list" description="Only these emails can register or check in. Paste a list, we'll tidy it up.">
              <Field label="Invited emails" htmlFor="invites" hint={`${inviteCount} valid email${inviteCount === 1 ? "" : "s"}. One per line, or separated by commas.`}>
                <textarea id="invites" className="input font-mono text-sm" rows={6} value={invites} onChange={(e) => setInvites(e.target.value)} placeholder={"sara@studio.com\ndev@buildfast.io"} />
              </Field>
              <button className="btn-primary w-full sm:w-auto" disabled={busy} onClick={saveInvites}>{busy ? "Saving…" : "Save invite list"}</button>
            </FormSection>
          )}

          <FormSection title="Sponsors" description="Shown on the event page and the big screen. Headline sponsors get top billing.">
            {sponsors.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {sponsors.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800">
                    {s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo_url} alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
                    ) : (
                      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-display font-extrabold text-zinc-400 dark:bg-zinc-800">{s.name[0]}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <span className={cn("chip mt-0.5 py-0.5 text-[11px] capitalize", TIER_STYLE[s.tier] ?? TIER_STYLE.supporter)}>{s.tier}</span>
                    </div>
                    <button className="btn-ghost btn-sm text-red-600" onClick={() => delSponsor(s.id)} aria-label={`Remove ${s.name}`}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addSponsor} className="space-y-4 rounded-2xl border-2 border-dashed border-zinc-200 p-4 dark:border-zinc-800">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sponsor name" htmlFor="sp-name" required>
                  <input id="sp-name" className="input" placeholder="Acme Cloud" required value={sp.name} onChange={(e) => setSp({ ...sp, name: e.target.value })} />
                </Field>
                <Field label="Website" htmlFor="sp-url" optional>
                  <input id="sp-url" className="input" type="url" placeholder="https://acme.dev" value={sp.url} onChange={(e) => setSp({ ...sp, url: e.target.value })} />
                </Field>
              </div>
              <Segmented label="Tier" options={TIERS} value={sp.tier} onChange={(tier) => setSp({ ...sp, tier })} />
              <ImageUpload label="Logo (optional)" userId={userId} value={sp.logo_url} onChange={(url) => setSp({ ...sp, logo_url: url })} />
              <button className="btn-secondary w-full" disabled={!sp.name.trim()}>+ Add sponsor</button>
            </form>
          </FormSection>

          <LifecyclePanel event={event} isOwner={isOwner} guestCount={guestCount} />
        </div>
      )}
    </div>
  );
}
