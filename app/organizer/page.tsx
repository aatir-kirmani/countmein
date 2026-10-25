import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { Empty } from "@/components/ui/Empty";
import { SeriesEditor } from "@/components/c/SeriesEditor";
import { eventStatus, fmtDate } from "@/lib/utils";
import type { EventRow } from "@/lib/types";

export default async function OrganizerPage() {
  const { supabase, user, profile } = await getProfile();
  const [{ data: events }, { data: series }] = await Promise.all([
    supabase.from("events").select("*, event_checkins(count)").eq("organizer_id", user!.id).order("starts_at", { ascending: false }),
    supabase.from("event_series").select("id,name,slug,description,city,cover_url").eq("organizer_id", user!.id).order("created_at"),
  ]);
  const rows = (events ?? []) as (EventRow & { event_checkins: { count: number }[] })[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Organizer</h1>
        <div className="flex gap-2">
          {profile?.is_admin && <Link href="/admin" className="btn-secondary">Admin</Link>}
          <Link href="/organizer/new" className="btn-primary">+ New event</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title="No events yet" body="Create your first event to get a code, a QR code and a live board." action={<Link href="/organizer/new" className="btn-primary">Create event</Link>} />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => {
            const st = eventStatus(e);
            return (
              <li key={e.id}>
                <Link href={`/organizer/${e.id}`} className="card flex items-center gap-3 p-3 hover:ring-brand">
                  {e.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.cover_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl dark:bg-zinc-800">🎟️</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="muted text-sm">{fmtDate(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</p>
                    <p className="muted text-xs">{e.event_checkins?.[0]?.count ?? 0} checked in · <span className="font-mono">{e.code}</span></p>
                  </div>
                  <span className={`chip shrink-0 ${st === "live" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-200 dark:bg-zinc-800"}`}>{st}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {series && series.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">My series</h2>
          <ul className="space-y-2">
            {series.map((s) => <SeriesEditor key={s.id} series={s} userId={user!.id} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
