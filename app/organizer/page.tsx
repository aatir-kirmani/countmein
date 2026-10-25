import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/Form";
import { SeriesEditor } from "@/components/c/SeriesEditor";
import { OrganizerEventCard } from "@/components/c/OrganizerEventCard";
import { eventStatus } from "@/lib/utils";
import type { EventRow } from "@/lib/types";

export default async function OrganizerPage() {
  const { supabase, user, profile } = await getProfile();
  const [{ data: events }, { data: series }] = await Promise.all([
    supabase.from("events").select("*, event_checkins(count)").eq("organizer_id", user!.id).order("starts_at", { ascending: false }),
    supabase.from("event_series").select("id,name,slug,description,city,cover_url").eq("organizer_id", user!.id).order("created_at"),
  ]);
  const rows = (events ?? []) as (EventRow & { event_checkins: { count: number }[] })[];
  const live = rows.filter((e) => eventStatus(e) === "live");
  const upcoming = rows.filter((e) => eventStatus(e) === "upcoming");
  const past = rows.filter((e) => eventStatus(e) === "ended");
  const totalCheckins = rows.reduce((n, e) => n + (e.event_checkins?.[0]?.count ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Host mode"
        title="Your events"
        description="Create a meetup, stick the QR code by the door, and watch the room pair up."
        action={
          <div className="flex gap-2">
            {profile?.is_admin && <Link href="/admin" className="btn-secondary btn-sm">Admin</Link>}
            <Link href="/organizer/new" className="btn-primary">+ New event</Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-8 text-center text-white">
          <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 text-white/10" />
          <div className="relative">
            <p className="text-5xl" aria-hidden>🎪</p>
            <h2 className="mt-3 text-3xl font-extrabold">Host your first meetup</h2>
            <p className="mx-auto mt-2 max-w-sm text-zinc-300">Takes about a minute. You get a door code, a QR poster and a live board for the projector.</p>
            <Link href="/organizer/new" className="btn-accent mt-6">Create an event <span aria-hidden>→</span></Link>
          </div>
        </section>
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-3 gap-2.5">
            {([["Events", rows.length], ["Check-ins", totalCheckins], ["Live now", live.length]] as const).map(([k, v]) => (
              <div key={k} className="card p-4">
                <p className="font-display text-3xl font-extrabold tabular-nums">{v}</p>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{k}</p>
              </div>
            ))}
          </section>
          {([["Happening now", live], ["Coming up", upcoming], ["Past events", past]] as const).map(([title, list]) =>
            list.length ? (
              <section key={title}>
                <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {list.map((e) => <li key={e.id}><OrganizerEventCard event={e} checkins={e.event_checkins?.[0]?.count ?? 0} /></li>)}
                </ul>
              </section>
            ) : null
          )}
        </>
      )}

      {series && series.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold">Your series</h2>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Recurring meetups get a community page with every past and upcoming event.</p>
          <ul className="space-y-2.5">
            {series.map((s) => <SeriesEditor key={s.id} series={s} userId={user!.id} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
