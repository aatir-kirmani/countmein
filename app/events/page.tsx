import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventsBrowser, type BrowseEvent } from "@/components/events/EventsBrowser";

export const metadata: Metadata = {
  title: "Events · Countmein",
  description: "Browse live and upcoming indie hacker meetups. Check in, show what you're building, and find collaborators.",
};
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id,name,code,description,starts_at,ends_at,venue,city,cover_url,timezone,capacity,require_approval,status,cancelled_at,series_id")
    .eq("visibility", "public")
    .is("cancelled_at", null)
    .gt("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(60);

  const events = (data ?? []) as Omit<BrowseEvent, "going">[];
  // Public counts per event (no identities).
  const withCounts: BrowseEvent[] = await Promise.all(
    events.map(async (e) => {
      const { data: s } = await supabase.rpc("event_public_stats", { p_event: e.id });
      const row = Array.isArray(s) ? s[0] : s;
      return { ...e, going: Number(row?.going ?? 0) };
    })
  );

  return (
    <div className="pt-2">
      <header className="mb-6">
        <p className="eyebrow">Find your people</p>
        <h1 className="mt-1 text-4xl font-extrabold leading-tight sm:text-5xl">Events</h1>
        <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">Live and upcoming meetups where builders are counting themselves in. Tap one to register or check in.</p>
      </header>
      <EventsBrowser events={withCounts} />
      <aside className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-zinc-900 p-6 text-white dark:bg-zinc-800">
        <div>
          <p className="font-display text-xl font-extrabold">Running a meetup?</p>
          <p className="text-sm text-zinc-300">Put it on the board in a minute. Free.</p>
        </div>
        <Link href="/organizer/new" className="btn-accent">Host an event →</Link>
      </aside>
    </div>
  );
}
