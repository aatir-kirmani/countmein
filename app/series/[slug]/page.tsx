import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
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

  const Item = ({ e, big }: { e: EventRow; big?: boolean }) => {
    const st = eventStatus(e);
    const d = new Date(e.starts_at);
    return (
      <Link href={`/e/${e.code}`} className={`card group flex items-center gap-4 p-3 transition hover:-translate-y-0.5 hover:shadow-md ${big ? "sm:p-4" : ""}`}>
        <span className={`flex shrink-0 flex-col items-center justify-center rounded-2xl ${st === "ended" ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" : "bg-brand text-white shadow-[0_3px_0_0_#4c1d95]"} ${big ? "h-16 w-16" : "h-14 w-14"}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest">{d.toLocaleDateString(undefined, { month: "short" })}</span>
          <span className="font-display text-2xl font-extrabold leading-none">{d.getDate()}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold group-hover:text-brand">{e.name}</p>
          <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{fmtDate(e.starts_at)}{e.venue ? ` · ${e.venue}` : ""}</p>
        </div>
        {st === "live" ? (
          <span className="chip shrink-0 bg-red-500 text-white"><span className="h-1.5 w-1.5 animate-blink rounded-full bg-white" aria-hidden /> Live</span>
        ) : (
          <span aria-hidden className="shrink-0 font-bold text-zinc-300 group-hover:text-brand dark:text-zinc-600">→</span>
        )}
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      <section className="full-bleed relative -mt-4 overflow-hidden bg-zinc-950 text-white">
        {series.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={series.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-violet-900/40" />
        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-16">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-lime-300">Community{series.city ? ` · ${series.city}` : ""}</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">{series.name}</h1>
          {series.description && <p className="mt-3 max-w-xl whitespace-pre-wrap text-zinc-300">{series.description}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            {series.organizer && (
              <Link href={`/u/${series.organizer.username}`} className="flex items-center gap-2 font-semibold hover:text-lime-300">
                <Avatar src={series.organizer.avatar_url} name={series.organizer.name ?? ""} size={28} />
                Hosted by {series.organizer.name || series.organizer.username}
              </Link>
            )}
            <span className="text-zinc-400">{rows.length} event{rows.length === 1 ? "" : "s"} so far</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-extrabold">Coming up</h2>
        {upcoming.length ? (
          <ul className="space-y-2.5">{upcoming.map((e) => <li key={e.id}><Item e={e} big /></li>)}</ul>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-3xl" aria-hidden>📅</p>
            <p className="mt-2 font-bold">The next one isn&apos;t on the calendar yet.</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Check back soon, or ask the host when the next meetup is.</p>
          </div>
        )}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">Past meetups</h2>
          <ul className="space-y-2">{past.map((e) => <li key={e.id}><Item e={e} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}
