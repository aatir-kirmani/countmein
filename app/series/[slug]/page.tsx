import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui/Empty";
import { eventStatus, fmtDate } from "@/lib/utils";
import type { EventRow } from "@/lib/types";

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: series } = await supabase.from("event_series").select("*, organizer:profiles(name,username,avatar_url)").eq("slug", slug).single();
  if (!series) notFound();
  const { data: events } = await supabase.from("events").select("*").eq("series_id", series.id).eq("visibility", "public").order("starts_at", { ascending: false });
  const rows = (events ?? []) as EventRow[];
  const upcoming = rows.filter((e) => eventStatus(e) !== "ended").reverse();
  const past = rows.filter((e) => eventStatus(e) === "ended");

  const List = ({ items }: { items: EventRow[] }) => (
    <ul className="space-y-2">
      {items.map((e) => (
        <li key={e.id}>
          <Link href={`/e/${e.code}`} className="card flex items-center justify-between gap-3 p-4 hover:ring-brand">
            <div className="min-w-0">
              <p className="truncate font-semibold">{e.name}</p>
              <p className="muted text-sm">{fmtDate(e.starts_at)}{e.venue ? ` · ${e.venue}` : ""}</p>
            </div>
            {eventStatus(e) === "live" && <span className="chip bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Live now</span>}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      {series.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={series.cover_url} alt="" className="h-40 w-full rounded-2xl object-cover" />
      )}
      <div>
        <h1 className="text-2xl font-bold">{series.name}</h1>
        {series.city && <p className="muted">{series.city}</p>}
        {series.description && <p className="mt-2 whitespace-pre-wrap">{series.description}</p>}
        {series.organizer && <p className="muted mt-2 text-sm">Organized by <Link className="underline" href={`/u/${series.organizer.username}`}>{series.organizer.name}</Link></p>}
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Upcoming</h2>
        {upcoming.length ? <List items={upcoming} /> : <Empty title="No upcoming events" body="Check back soon." />}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Past events</h2>
          <List items={past} />
        </section>
      )}
    </div>
  );
}
