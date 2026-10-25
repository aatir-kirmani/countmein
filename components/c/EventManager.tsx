"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { EventForm } from "./EventForm";
import { eventStatus, fmtDate, timeAgo } from "@/lib/utils";
import type { EventRow } from "@/lib/types";

type Stats = { attendees: number; projects: number; requests: number; matches: number; open_slots: number } | null;
type Checkin = { user_id: string; checked_in_at: string; location_note: string | null; profile: { name: string; username: string; avatar_url: string | null; skills: string[] } | null };
type Sponsor = { id: string; name: string; logo_url: string | null; url: string | null; tier: string };

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
  const [sp, setSp] = useState({ name: "", url: "", logo_url: "", tier: "supporter" });
  const [busy, setBusy] = useState(false);
  const st = eventStatus(event);

  const setStatus = async (status: "live" | "ended") => {
    if (status === "ended" && !confirm("End this event? The board becomes read-only.")) return;
    const patch: Partial<EventRow> = { status };
    if (status === "live" && new Date(event.starts_at) > new Date()) patch.starts_at = new Date().toISOString();
    if (status === "ended" && new Date(event.ends_at) > new Date()) patch.ends_at = new Date().toISOString();
    const { error } = await supabase.from("events").update(patch).eq("id", event.id);
    if (error) toast(error.message, { kind: "error" });
    else { toast(status === "live" ? "Event is live" : "Event ended"); router.refresh(); }
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
      .insert({ event_id: event.id, name: sp.name.trim(), url: sp.url.trim() || null, logo_url: sp.logo_url.trim() || null, tier: sp.tier })
      .select().single();
    if (error) return toast(error.message, { kind: "error" });
    setSponsors((s) => [...s, data]);
    setSp({ name: "", url: "", logo_url: "", tier: "supporter" });
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
    if (res.ok) toast(`Recap sent to ${body.sent ?? 0} people`, { kind: "success" });
    else toast(body.error || "Failed to send recap", { kind: "error" });
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast("Copied"));

  const deleteEvent = async () => {
    if (!confirm("Delete this event permanently? This cannot be undone.")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) toast(error.message, { kind: "error" });
    else router.push("/organizer");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/organizer" className="muted text-sm">← All events</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <span className={`chip ${st === "live" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-200 dark:bg-zinc-800"}`}>{st}</span>
        </div>
        <p className="muted text-sm">{fmtDate(event.starts_at)} → {fmtDate(event.ends_at)}{event.venue ? ` · ${event.venue}` : ""}</p>
      </div>

      <section className="card grid gap-4 p-4 sm:grid-cols-[200px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${eventUrl}`} className="mx-auto w-48 rounded-xl bg-white" />
        <div className="space-y-3">
          <div>
            <p className="muted text-xs uppercase tracking-wide">Event code</p>
            <p className="font-mono text-4xl font-black tracking-widest">{event.code}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => copy(eventUrl)}>Copy link</button>
            <a className="btn-secondary" href={qr} download={`countmein-${event.code}.png`}>Download QR</a>
            <Link className="btn-primary" href={`/e/${event.code}/board`} target="_blank">Open Live Board ↗</Link>
            <Link className="btn-secondary" href={`/e/${event.code}`}>Attendee view</Link>
          </div>
          <p className="muted break-all text-xs">{eventUrl}</p>
        </div>
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {([["Attendees", stats.attendees], ["Projects", stats.projects], ["Requests", stats.requests], ["Matches", stats.matches], ["Open slots", stats.open_slots]] as const).map(([k, v]) => (
            <div key={k} className="card p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{v}</p>
              <p className="muted text-xs">{k}</p>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        {st === "upcoming" && <button className="btn-primary" onClick={() => setStatus("live")}>Start now</button>}
        {st !== "ended" && <button className="btn-secondary" onClick={() => setStatus("ended")}>End event</button>}
        <a className="btn-secondary" href={`/api/events/${event.id}/export`}>Export CSV</a>
        <button className="btn-secondary" disabled={busy} onClick={sendRecap}>Send recap now</button>
        <button className="btn-secondary" onClick={() => setEditing((v) => !v)}>{editing ? "Close editor" : "Edit event"}</button>
      </section>

      {editing && (
        <section className="card p-4">
          <EventForm userId={userId} series={props.series} event={event} />
        </section>
      )}

      {event.visibility === "invite_only" && (
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">Invite list</h2>
          <p className="muted text-sm">One email per line. Only these people can check in.</p>
          <textarea className="input font-mono text-sm" rows={6} value={invites} onChange={(e) => setInvites(e.target.value)} aria-label="Invited emails" />
          <button className="btn-primary" disabled={busy} onClick={saveInvites}>Save invites</button>
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Sponsors</h2>
        {sponsors.length > 0 && (
          <ul className="space-y-2">
            {sponsors.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.logo_url && <img src={s.logo_url} alt="" className="h-8 w-8 rounded object-contain" />}
                  <span className="font-medium">{s.name}</span>
                  <span className="chip bg-zinc-100 dark:bg-zinc-800">{s.tier}</span>
                </span>
                <button className="btn-ghost text-sm" onClick={() => delSponsor(s.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addSponsor} className="grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="Sponsor name" required value={sp.name} onChange={(e) => setSp({ ...sp, name: e.target.value })} aria-label="Sponsor name" />
          <select className="input" value={sp.tier} onChange={(e) => setSp({ ...sp, tier: e.target.value })} aria-label="Tier">
            <option value="headline">Headline</option>
            <option value="gold">Gold</option>
            <option value="supporter">Supporter</option>
          </select>
          <input className="input" type="url" placeholder="Website URL" value={sp.url} onChange={(e) => setSp({ ...sp, url: e.target.value })} aria-label="Sponsor URL" />
          <input className="input" type="url" placeholder="Logo URL" value={sp.logo_url} onChange={(e) => setSp({ ...sp, logo_url: e.target.value })} aria-label="Logo URL" />
          <button className="btn-secondary sm:col-span-2" disabled={!sp.name.trim()}>Add sponsor</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Attendees ({checkins.length})</h2>
        {checkins.length === 0 ? (
          <p className="muted text-sm">No one has checked in yet. Put the QR code on screen!</p>
        ) : (
          <ul className="card divide-y divide-zinc-200 dark:divide-zinc-800">
            {checkins.map((c) => (
              <li key={c.user_id} className="flex items-center gap-3 p-3">
                <Avatar src={c.profile?.avatar_url} name={c.profile?.name ?? ""} size={36} />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${c.profile?.username}`} className="font-medium hover:underline">{c.profile?.name || c.profile?.username}</Link>
                  <p className="muted truncate text-xs">{c.profile?.skills?.join(", ")}</p>
                </div>
                <span className="muted text-xs">{timeAgo(c.checked_in_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button className="btn-ghost text-red-600" onClick={deleteEvent}>Delete event</button>
      </section>
    </div>
  );
}
