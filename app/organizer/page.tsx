import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Empty } from "@/components/ui/Empty";
import { eventStatus, fmtDate } from "@/lib/utils";
import type { EventRow } from "@/lib/types";

export default async function OrganizerPage() {
  const { supabase, user } = await getUser();
  const [{ data: events }, { data: series }] = await Promise.all([
    supabase.from("events").select("*, event_checkins(count)").eq("organizer_id", user!.id).order("starts_at", { ascending: false }),
    supabase.from("event_series").select("id,name,slug").eq("organizer_id", user!.id).order("created_at"),
  ]);
  const rows = (events ?? []) as (EventRow & { event_checkins: { count: number }[] })[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizer</h1>
        <Link href="/organizer/new" className="btn-primary">+ New event</Link>
      </div>

      {rows.length === 0 ? (
        <Empty title="No events yet" body="Create your first event to get a code, QR, and live board." action={<Link href="/organizer/new" className="btn-primary">Create event</Link>} />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => {
            const st = eventStatus(e);
            return (
              <li key={e.id}>
                <Link href={`/organizer/${e.id}`} className="card flex items-center justify-between gap-3 p-4 hover:ring-brand">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="muted text-sm">{fmtDate(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                    <span className={`chip ${st === "live" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-200 dark:bg-zinc-800"}`}>{st}</span>
                    <span className="font-mono text-xs">{e.code}</span>
                    <span className="muted text-xs">{e.event_checkins?.[0]?.count ?? 0} checked in</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {series && series.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">My series</h2>
          <ul className="flex flex-wrap gap-2">
            {series.map((s) => <li key={s.id}><Link href={`/series/${s.slug}`} className="btn-secondary">{s.name}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
