"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtInZone } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/lib/types";
import { HIcon, StatTile } from "./ui";

export type Insights = {
  page_views: number; going: number; pending: number; waitlist: number; declined: number; cancelled: number;
  checked_in: number; projects: number; requests: number; matches: number;
  registrations_by_day: { day: string; count: number }[];
  checkins_by_hour: { hour: string; count: number }[];
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Bars({ data, label, empty }: { data: { key: string; label: string; count: number }[]; label: string; empty: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="card p-5">
      <p className="font-bold">{label}</p>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
          {data.map((d) => (
            <div key={d.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-bold tabular-nums text-zinc-500 opacity-0 transition group-hover:opacity-100">{d.count}</span>
              <div className="w-full rounded-t-lg bg-gradient-to-t from-brand to-fuchsia-500" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
              <span className="w-full truncate text-center text-[10px] text-zinc-500">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightsPanel({ event, initial }: { event: EventRow; initial: Insights | null }) {
  const [data, setData] = useState<Insights | null>(initial);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data: d } = await createClient().rpc("event_insights", { p_event: event.id });
    setLoading(false);
    if (d) setData(d as Insights);
  };

  if (!data) {
    return <p className="rounded-3xl bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:bg-zinc-900/60">Insights aren&apos;t available for this event.</p>;
  }

  const registered = data.going + data.pending + data.waitlist + data.declined + data.cancelled;
  const posted = data.projects;
  const funnel = [
    { label: "Page views", value: data.page_views, note: "People who opened the event page" },
    { label: "Registered", value: registered, note: `${pct(registered, data.page_views)}% of views` },
    { label: "Checked in", value: data.checked_in, note: `${pct(data.checked_in, data.going || registered)}% of going` },
    { label: "Projects posted", value: posted, note: `By ${data.checked_in} ${data.checked_in === 1 ? "person" : "people"} in the room` },
    { label: "Matches", value: data.matches, note: `${pct(data.matches, data.requests)}% of ${data.requests} requests accepted` },
  ];
  const top = Math.max(1, funnel[0].value, ...funnel.map((f) => f.value));
  const tz = event.timezone || "UTC";

  const byDay = data.registrations_by_day.slice(-14).map((d) => ({
    key: d.day, count: d.count,
    label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  const byHour = data.checkins_by_hour.map((h) => ({ key: h.hour, count: h.count, label: fmtInZone(h.hour, tz, { hour: "numeric" }) }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">How people found, joined and used your event.</p>
        <button className="btn-ghost btn-sm" onClick={reload} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>

      <section className="card p-5" aria-label="Funnel">
        <p className="font-bold">Funnel</p>
        <ol className="mt-4 space-y-3">
          {funnel.map((f, i) => (
            <li key={f.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{f.label}</span>
                <span className="font-display text-lg font-extrabold tabular-nums">{f.value}</span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={cn("h-full rounded-full", i === funnel.length - 1 ? "bg-lime-400" : "bg-gradient-to-r from-brand to-fuchsia-500")}
                  style={{ width: `${Math.max(f.value ? 3 : 0, (f.value / top) * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">{f.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Registration breakdown" className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <StatTile label="Going" value={data.going} tone="lime" />
        <StatTile label="Pending" value={data.pending} tone="amber" />
        <StatTile label="Waitlist" value={data.waitlist} tone="sky" />
        <StatTile label="Declined" value={data.declined} />
        <StatTile label="Cancelled" value={data.cancelled} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars data={byDay} label="Registrations by day" empty="No registrations yet." />
        <Bars data={byHour} label={`Check-ins by hour (${tz})`} empty="Nobody has checked in yet." />
      </div>

      <p className="flex items-center gap-2 text-xs text-zinc-500"><HIcon name="eye" className="h-4 w-4" /> Page views count each visit to the event page, including repeat visits.</p>
    </div>
  );
}
