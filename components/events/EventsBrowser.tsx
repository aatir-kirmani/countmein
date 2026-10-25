"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtInZone, tzLabel } from "@/lib/time";
import { eventStatus, cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/Form";

export type BrowseEvent = {
  id: string; name: string; code: string; description: string | null; starts_at: string; ends_at: string;
  venue: string | null; city: string | null; cover_url: string | null; timezone: string; capacity: number | null;
  require_approval: boolean; status: "upcoming" | "live" | "ended"; cancelled_at: string | null; series_id: string | null; going: number;
};

type When = "all" | "live" | "week" | "later";

export function EventsBrowser({ events }: { events: BrowseEvent[] }) {
  const [q, setQ] = useState("");
  const [when, setWhen] = useState<When>("all");
  const [city, setCity] = useState("all");

  const cities = useMemo(() => Array.from(new Set(events.map((e) => e.city?.trim()).filter((c): c is string => !!c))).sort(), [events]);
  const liveCount = useMemo(() => events.filter((e) => eventStatus(e) === "live").length, [events]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const weekEnd = Date.now() + 7 * 864e5;
    return events.filter((e) => {
      const st = eventStatus(e);
      if (when === "live" && st !== "live") return false;
      if (when === "week" && !(st === "live" || new Date(e.starts_at).getTime() <= weekEnd)) return false;
      if (when === "later" && new Date(e.starts_at).getTime() <= weekEnd) return false;
      if (city !== "all" && e.city?.trim() !== city) return false;
      if (term && !`${e.name} ${e.city ?? ""} ${e.venue ?? ""} ${e.description ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [events, q, when, city]);

  if (events.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
        <span aria-hidden className="text-4xl">🗓️</span>
        <p className="font-display text-xl font-extrabold">No public events yet</p>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">Be the first to put your meetup on the board. Have a code? Enter it on the home page.</p>
        <Link href="/organizer/new" className="btn-primary mt-3">Host the first one</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="relative">
          <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input className="input pl-11" type="search" placeholder="Search by name, city or venue" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Segmented
              label="When" hideLabel value={when} onChange={setWhen}
              options={[
                { value: "all", label: "All" },
                { value: "live", label: liveCount ? `Live (${liveCount})` : "Live" },
                { value: "week", label: "Soon" },
                { value: "later", label: "Later" },
              ]}
            />
          </div>
          {cities.length > 1 && (
            <select className="input sm:w-48" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
              <option value="all">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="font-semibold">Nothing matches that</p>
          <button className="mt-2 text-sm font-bold text-brand dark:text-violet-300" onClick={() => { setQ(""); setWhen("all"); setCity("all"); }}>Clear filters</button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((e) => <EventCard key={e.id} e={e} />)}
        </ul>
      )}
    </div>
  );
}

function EventCard({ e }: { e: BrowseEvent }) {
  const st = eventStatus(e);
  const day = fmtInZone(e.starts_at, e.timezone, { weekday: "short", day: "numeric", month: "short" });
  const time = `${fmtInZone(e.starts_at, e.timezone, { hour: "numeric", minute: "2-digit" })} ${tzLabel(e.starts_at, e.timezone)}`;
  const spotsLeft = e.capacity ? Math.max(0, e.capacity - e.going) : null;
  return (
    <li>
      <Link href={`/e/${e.code}`} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(109,40,217,.45)]">
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400">
          {e.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            {st === "live" ? (
              <span className="chip bg-red-500 text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />Live now</span>
            ) : (
              <span className="chip bg-white/90 text-zinc-900 backdrop-blur">{day}</span>
            )}
            {e.require_approval && <span className="chip bg-zinc-900/80 text-white backdrop-blur">Approval</span>}
          </div>
        </div>
        <div className="p-4">
          <h2 className="line-clamp-1 text-lg font-extrabold leading-snug">{e.name}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{st === "live" ? "Happening now" : day} · {time}</p>
          {(e.venue || e.city) && <p className="line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">📍 {[e.venue, e.city].filter(Boolean).join(", ")}</p>}
          <div className="mt-3 flex items-center justify-between">
            <span className={cn("text-xs font-semibold", spotsLeft !== null && spotsLeft <= 10 ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400")}>
              {e.going > 0 ? `${e.going} going` : "Be the first to join"}
              {spotsLeft !== null && ` · ${spotsLeft === 0 ? "Full" : `${spotsLeft} spots left`}`}
            </span>
            <span className="text-sm font-bold text-brand transition group-hover:translate-x-0.5 dark:text-violet-300">{st === "live" ? "Check in →" : "View →"}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
