"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Field, FormSection, Segmented } from "@/components/ui/Form";
import { EventForm } from "./EventForm";
import { cn, eventStatus, fmtDate, timeAgo } from "@/lib/utils";
import type { EventRow } from "@/lib/types";

type Stats = { attendees: number; projects: number; requests: number; matches: number; open_slots: number } | null;
type Checkin = { user_id: string; checked_in_at: string; location_note: string | null; profile: { name: string; username: string; avatar_url: string | null; skills: string[] } | null };
type Sponsor = { id: string; name: string; logo_url: string | null; url: string | null; tier: string };

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
  if (status === "upcoming") return <span className="chip bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200">Upcoming</span>;
  return <span className="chip bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Ended</span>;
}

/** Simple line icons used across the control room. */
const ICONS: Record<string, string> = {
  board: "M3 5h18v12H3zM8 21h8M12 17v4",
  poster: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h3",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2",
  csv: "M12 3v12M7 10l5 5 5-5M5 21h14",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4",
};

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
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
        <Icon name={icon} />
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
  event: EventRow; userId: string; eventUrl: string; qr: string; stats: Stats;
  checkins: Checkin[]; invites: string[]; sponsors: Sponsor[]; series: { id: string; name: string }[];
}) {
  const { event, userId, eventUrl, qr, stats, checkins } = props;
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const [editing, setEditing] = useState(false);
  const [invites, setInvites] = useState(props.invites.join("\n"));
  const [sponsors, setSponsors] = useState(props.sponsors);
  const [sp, setSp] = useState<{ name: string; url: string; logo_url: string | null; tier: string }>({ name: "", url: "", logo_url: null, tier: "supporter" });
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const st = eventStatus(event);
  const photoCount = (event.cover_url ? 1 : 0) + (event.gallery_urls?.length ?? 0);

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

  const deleteEvent = async () => {
    if (!confirm("Delete this event permanently? This cannot be undone.")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) toast(error.message, { kind: "error" });
    else router.push("/organizer");
  };

  const inviteCount = invites.split(/[\s,;]+/).filter((e) => /.+@.+\..+/.test(e)).length;
  const q = query.trim().toLowerCase();
  const shown = q
    ? checkins.filter((c) => [c.profile?.name, c.profile?.username, ...(c.profile?.skills ?? [])].some((v) => v?.toLowerCase().includes(q)))
    : checkins;

  return (
    <div className="space-y-6">
      <Link href="/organizer" className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
        <span aria-hidden>←</span> All events
      </Link>

      {/* Hero: cover, name, status, code and QR */}
      <section className="card overflow-hidden">
        <div className="relative h-40 sm:h-52 overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-fuchsia-500">
        <div aria-hidden className="dot-grid absolute inset-0 text-white/15" />
        <span aria-hidden className="absolute -bottom-8 -right-6 h-28 w-28 rounded-full bg-lime-300/90" />
          {event.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-t to-transparent", event.cover_url ? "from-black/70 via-black/20" : "from-black/30")} />
          <div className="absolute left-4 top-4 flex gap-2">
            <StatusPill status={st} />
            {photoCount > 0 && (
              <span className="chip bg-black/50 text-white backdrop-blur">
                {photoCount} photo{photoCount === 1 ? "" : "s"}{event.video_url ? " + video" : ""}
              </span>
            )}
          </div>
          <div className="absolute inset-x-4 bottom-4 text-white">
            <h1 className="text-2xl font-extrabold leading-tight drop-shadow sm:text-3xl">{event.name}</h1>
            <p className="mt-1 text-sm text-white/85">
              {fmtDate(event.starts_at)} to {fmtDate(event.ends_at)}{event.venue ? ` · ${event.venue}` : ""}
            </p>
          </div>
        </div>

        <div className="grid items-center gap-5 p-5 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto rounded-2xl bg-white p-2 ring-1 ring-zinc-200 sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code for ${eventUrl}`} className="h-40 w-40" />
          </div>
          <div className="text-center sm:text-left">
            <p className="eyebrow">Door code</p>
            <div className="mt-2 flex justify-center gap-1.5 sm:justify-start" aria-label={`Event code ${event.code}`}>
              {event.code.split("").map((ch, i) => (
                <span key={i} aria-hidden className="flex h-12 w-10 items-center justify-center rounded-xl bg-brand font-mono text-2xl font-bold text-white shadow-[0_3px_0_0_#4c1d95]">
                  {ch}
                </span>
              ))}
            </div>
            <button type="button" onClick={() => copy(eventUrl)} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
              <span className="truncate">{eventUrl.replace(/^https?:\/\//, "")}</span>
              <span className="shrink-0 font-bold text-brand dark:text-violet-300">Copy</span>
            </button>
          </div>
        </div>
      </section>

      {/* Primary status action */}
      {st !== "ended" && (
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

      {/* Action grid */}
      <section aria-label="Event actions" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <ActionTile icon="board" label="Live Board" sub="Put it on the projector" href={`/e/${event.code}/board`} external tone="brand" />
        <ActionTile icon="poster" label="Door poster" sub="Print-ready A4" href={`/organizer/${event.id}/poster`} external />
        <ActionTile icon="qr" label="Download QR" sub="PNG for slides" href={qr} download={`countmein-${event.code}.png`} />
        <ActionTile icon="eye" label="Attendee view" sub="See what they see" href={`/e/${event.code}`} />
        <ActionTile icon="link" label="Copy link" sub="For chats and socials" onClick={() => copy(eventUrl)} />
        <ActionTile icon="csv" label="Export CSV" sub="Attendees and projects" href={`/api/events/${event.id}/export`} download={`countmein-${event.code}.csv`} />
        <ActionTile icon="mail" label="Send recap" sub="Email everyone now" onClick={sendRecap} disabled={busy} />
        <ActionTile icon="edit" label={editing ? "Close editor" : "Edit event"} sub="Details, photos, video" onClick={() => setEditing((v) => !v)} />
      </section>

      {/* Stats */}
      {stats && (
        <section aria-label="Live stats" className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {([
            ["Matches made", stats.matches, "🎉"],
            ["Here now", stats.attendees, "🙋"],
            ["Projects", stats.projects, "🚀"],
            ["Requests", stats.requests, "✋"],
            ["Open slots", stats.open_slots, "🧩"],
          ] as const).map(([k, v, icon], i) => (
            <div key={k} className={cn("card p-4", i === 0 && "col-span-2 flex items-center justify-between bg-lime-100 ring-lime-200 sm:col-span-1 sm:block dark:bg-lime-950/40 dark:ring-lime-900")}>
              <p className={cn(i === 0 ? "order-2 text-4xl sm:text-lg" : "text-lg")} aria-hidden>{icon}</p>
              <div>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{v}</p>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{k}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {editing && (
        <section className="card p-4 sm:p-6">
          <EventForm userId={userId} series={props.series} event={event} />
        </section>
      )}

      {/* Attendees */}
      <FormSection
        title={`Who's here · ${checkins.length}`}
        description="Everyone who checked in, newest first."
      >
        {checkins.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 p-6 text-center dark:bg-zinc-900/60">
            <p className="text-3xl" aria-hidden>🚪</p>
            <p className="mt-2 font-semibold">The door is open, the room is empty.</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Put the QR code on screen or print the poster. Check-ins show up here instantly.</p>
          </div>
        ) : (
          <>
            {checkins.length > 5 && (
              <input className="input" type="search" placeholder="Search by name or skill" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search attendees" />
            )}
            <ul className="-mx-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {shown.map((c) => (
                <li key={c.user_id} className="flex items-center gap-3 px-2 py-3">
                  <Avatar src={c.profile?.avatar_url} name={c.profile?.name ?? ""} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/u/${c.profile?.username}`} className="font-semibold hover:text-brand">{c.profile?.name || c.profile?.username}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(c.profile?.skills ?? []).slice(0, 3).map((s) => (
                        <span key={s} className="chip bg-zinc-100 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{s}</span>
                      ))}
                      {c.location_note && <span className="chip bg-sky-50 py-0.5 text-[11px] text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">📍 {c.location_note}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">{timeAgo(c.checked_in_at)}</span>
                </li>
              ))}
              {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-zinc-500">No one matches &ldquo;{query}&rdquo;.</li>}
            </ul>
          </>
        )}
      </FormSection>

      {event.visibility === "invite_only" && (
        <FormSection title="Guest list" description="Only these emails can check in. Paste a list, we'll tidy it up.">
          <Field label="Invited emails" htmlFor="invites" hint={`${inviteCount} valid email${inviteCount === 1 ? "" : "s"}. One per line, or separated by commas.`}>
            <textarea id="invites" className="input font-mono text-sm" rows={6} value={invites} onChange={(e) => setInvites(e.target.value)} placeholder={"sara@studio.com\ndev@buildfast.io"} />
          </Field>
          <button className="btn-primary w-full sm:w-auto" disabled={busy} onClick={saveInvites}>{busy ? "Saving…" : "Save guest list"}</button>
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

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 ring-1 ring-inset ring-red-200 dark:ring-red-900/60">
        <div>
          <p className="font-bold text-red-700 dark:text-red-400">Danger zone</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Deleting removes the event, check-ins and its board for everyone.</p>
        </div>
        <button className="btn-danger btn-sm" onClick={deleteEvent}>Delete event</button>
      </section>
    </div>
  );
}
