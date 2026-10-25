import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { EventCodeForm } from "@/components/a/EventCodeForm";
import { eventStatus, fmtDate } from "@/lib/utils";

export default async function Home() {
  const { supabase, user } = await getUser();
  let events: { id: string; name: string; code: string; starts_at: string; ends_at: string; status: string; city: string | null }[] = [];
  if (user) {
    const { data } = await supabase
      .from("event_checkins")
      .select("checked_in_at, events(id,name,code,starts_at,ends_at,status,city)")
      .eq("user_id", user.id)
      .order("checked_in_at", { ascending: false })
      .limit(5);
    events = (data ?? []).map((r: { events: unknown }) => r.events as (typeof events)[number]).filter(Boolean);
  }

  return (
    <div className="space-y-8">
      <section className="pt-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Find your next collaborator <span className="text-brand">in the room.</span>
        </h1>
        <p className="muted mx-auto mt-3 max-w-md">
          Check in to your indie hacker meetup, share what you&apos;re building, and tap <strong>Count me in</strong> to team up with someone on the spot.
        </p>
      </section>

      <section className="card mx-auto max-w-md p-5">
        <h2 className="mb-3 font-semibold">Join an event</h2>
        <EventCodeForm />
        <p className="muted mt-3 text-xs">Or scan the QR code at the venue with your camera.</p>
      </section>

      {user ? (
        <section className="mx-auto max-w-md space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My events</h2>
            <Link href="/organizer" className="text-sm font-medium text-brand">Host an event →</Link>
          </div>
          {events.length === 0 ? (
            <p className="muted text-sm">You haven&apos;t checked in to any events yet.</p>
          ) : (
            events.map((e) => (
              <Link key={e.id} href={`/e/${e.code}`} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="muted text-xs">{fmtDate(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</p>
                </div>
                <span className="chip bg-zinc-100 dark:bg-zinc-800">{eventStatus(e as never)}</span>
              </Link>
            ))
          )}
        </section>
      ) : (
        <section className="mx-auto grid max-w-md gap-3 text-sm">
          {[
            ["1", "Check in", "Scan the QR code and sign in. It takes under 30 seconds."],
            ["2", "Post what you're building", "Say which roles you need, or open it up to anyone."],
            ["3", "Count me in", "Request to join, get accepted, and swap contacts."],
          ].map(([n, t, b]) => (
            <div key={n} className="card flex gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">{n}</span>
              <div><p className="font-semibold">{t}</p><p className="muted">{b}</p></div>
            </div>
          ))}
          <Link href="/login" className="btn-primary mt-2">Sign in</Link>
        </section>
      )}
    </div>
  );
}
