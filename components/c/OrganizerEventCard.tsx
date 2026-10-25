import Link from "next/link";
import { StatusPill } from "./EventManager";
import { eventStatus, fmtDate } from "@/lib/utils";
import type { EventRow } from "@/lib/types";

export function OrganizerEventCard({ event: e, checkins }: { event: EventRow; checkins: number }) {
  const st = eventStatus(e);
  return (
    <Link href={`/organizer/${e.id}`} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-fuchsia-500">
        <div aria-hidden className="dot-grid absolute inset-0 text-white/15" />
        <span aria-hidden className="absolute -bottom-8 -right-6 h-28 w-28 rounded-full bg-lime-300/90" />
        {e.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        {e.cover_url && <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />}
        <div className="absolute left-3 top-3"><StatusPill status={st} /></div>
        <span className="absolute bottom-3 right-3 rounded-lg bg-white/95 px-2 py-1 font-mono text-xs font-bold tracking-widest text-zinc-900">{e.code}</span>
      </div>
      <div className="p-4">
        <p className="truncate font-display text-lg font-extrabold">{e.name}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-400">{fmtDate(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</p>
        <p className="mt-3 flex items-center justify-between text-sm">
          <span className="font-semibold"><span className="tabular-nums">{checkins}</span> checked in{e.capacity ? <span className="font-normal text-zinc-500"> / {e.capacity}</span> : null}</span>
          <span className="font-bold text-brand dark:text-violet-300">Manage →</span>
        </p>
      </div>
    </Link>
  );
}
