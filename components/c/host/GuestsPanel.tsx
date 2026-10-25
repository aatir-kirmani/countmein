"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { cn, timeAgo } from "@/lib/utils";
import type { EventRow, RegistrationStatus } from "@/lib/types";
import { countGuests, matchesFilter, type Guest, type GuestFilter } from "./core";
import { notifyGuest } from "./guests";
import { GuestStatusChip, HIcon } from "./ui";

const FILTERS: { value: GuestFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "going", label: "Going" },
  { value: "pending", label: "Pending" },
  { value: "waitlist", label: "Waitlist" },
  { value: "checked_in", label: "Checked in" },
  { value: "declined", label: "Declined" },
];

type Action = "approve" | "waitlist" | "decline" | "checkin" | "undo";

export function GuestsPanel({ event, guests, setGuests, refresh, filter, setFilter }: {
  event: EventRow; guests: Guest[]; setGuests: React.Dispatch<React.SetStateAction<Guest[]>>; refresh: () => Promise<void>;
  filter: GuestFilter; setFilter: (f: GuestFilter) => void;
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const counts = useMemo(() => countGuests(guests), [guests]);
  const questions = event.registration_questions ?? [];

  const q = query.trim().toLowerCase();
  const shown = guests.filter((g) => matchesFilter(g, filter) && (!q || [g.profile?.name, g.profile?.username, ...(g.profile?.skills ?? []), ...Object.values(g.answers ?? {})].some((v) => v?.toLowerCase().includes(q))));
  const waiting = counts.pending + counts.waitlist;

  const patchLocal = (userId: string, p: Partial<Guest>) => setGuests((gs) => gs.map((g) => (g.user_id === userId ? { ...g, ...p } : g)));

  const act = async (g: Guest, action: Action) => {
    const name = g.profile?.name || g.profile?.username || "Guest";
    const before = { status: g.status, checked_in_at: g.checked_in_at };
    setBusy(g.user_id);
    let error: { message: string } | null = null;
    if (action === "checkin") {
      patchLocal(g.user_id, { status: "going", checked_in_at: new Date().toISOString() });
      ({ error } = await supabase.rpc("host_check_in", { p_event: event.id, p_user: g.user_id }));
    } else if (action === "undo") {
      patchLocal(g.user_id, { checked_in_at: null });
      ({ error } = await supabase.rpc("host_undo_check_in", { p_event: event.id, p_user: g.user_id }));
    } else {
      const status: RegistrationStatus = action === "approve" ? "going" : action === "waitlist" ? "waitlist" : "declined";
      patchLocal(g.user_id, { status, ...(status === "declined" ? { checked_in_at: null } : {}) });
      ({ error } = await supabase.rpc("host_set_registration", { p_event: event.id, p_user: g.user_id, p_status: status }));
      if (!error) notifyGuest(event.id, g.user_id, status);
    }
    setBusy(null);
    if (error) {
      patchLocal(g.user_id, before);
      return toast(error.message, { kind: "error" });
    }
    const msg: Record<Action, string> = {
      approve: `${name} is going`, waitlist: `${name} moved to the waitlist`, decline: `${name} was declined`,
      checkin: `${name} checked in`, undo: `Check-in undone for ${name}`,
    };
    toast(msg[action], { kind: action === "decline" || action === "undo" ? "info" : "success" });
  };

  const approveAll = async () => {
    if (!confirm(`Approve all ${waiting} people who are pending or on the waitlist?`)) return;
    setBusy("all");
    const ids = guests.filter((g) => g.status === "pending" || g.status === "waitlist").map((g) => g.user_id);
    const { data, error } = await supabase.rpc("host_approve_all", { p_event: event.id });
    setBusy(null);
    if (error) return toast(error.message, { kind: "error" });
    ids.forEach((id) => notifyGuest(event.id, id, "going"));
    toast(`${data ?? ids.length} approved`, { kind: "success" });
    refresh();
  };

  const primary = (g: Guest): { action: Action; label: string; cls: string } | null => {
    if (g.checked_in_at) return null;
    if (g.status === "pending" || g.status === "waitlist") return { action: "approve", label: "Approve", cls: "btn-accent" };
    if (g.status === "going") return { action: "checkin", label: "Check in", cls: "btn-secondary" };
    return null;
  };

  return (
    <section aria-label="Guests" className="space-y-4">
      {/* Filter chips with counts */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filter guests">
        {FILTERS.map((f) => {
          const on = filter === f.value;
          return (
            <button
              key={f.value} role="tab" aria-selected={on} onClick={() => setFilter(f.value)}
              className={cn("flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ring-1 ring-inset transition",
                on ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900 dark:ring-white" : "bg-white ring-zinc-200 hover:ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-800")}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-white/20 dark:bg-zinc-900/10" : f.value === "pending" && counts.pending ? "bg-amber-200 text-amber-950" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>
                {counts[f.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search guests</span>
          <HIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input className="input pl-10" type="search" placeholder="Search name, skill or answer" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {waiting >= 2 && (
          <button className="btn-accent shrink-0" onClick={approveAll} disabled={busy === "all"}>
            <HIcon name="check" className="h-4 w-4" /> Approve all {waiting}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl bg-zinc-50 p-8 text-center ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800">
          <p className="text-3xl" aria-hidden>{q ? "🔎" : filter === "pending" ? "🧘" : "🎟️"}</p>
          <p className="mt-2 font-semibold">
            {q ? `No one matches "${query}"` : filter === "pending" ? "Nobody is waiting for approval" : filter === "all" ? "No guests yet" : `No one in ${FILTERS.find((f) => f.value === filter)?.label}`}
          </p>
          {!q && filter === "all" && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Share the event link. Registrations and check-ins show up here live.</p>}
        </div>
      ) : (
        <ul className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
          {shown.map((g) => {
            const p = primary(g);
            const expanded = open === g.user_id;
            const answered = questions.filter((qq) => (g.answers?.[qq.id] ?? "").trim());
            return (
              <li key={g.user_id}>
                <div className="flex items-center gap-3 p-3.5 sm:p-4">
                  <button
                    type="button" onClick={() => setOpen(expanded ? null : g.user_id)} aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar src={g.profile?.avatar_url} name={g.profile?.name ?? ""} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-bold">{g.profile?.name || g.profile?.username || "Guest"}</span>
                        <GuestStatusChip guest={g} className="py-0.5 text-[11px]" />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {g.checked_in_at ? `Checked in ${timeAgo(g.checked_in_at)}` : g.registered_at ? `Registered ${timeAgo(g.registered_at)}` : ""}
                        {(g.profile?.skills ?? []).length > 0 && ` · ${(g.profile?.skills ?? []).slice(0, 3).join(", ")}`}
                      </span>
                    </span>
                    <HIcon name="chevron" className={cn("h-4 w-4 shrink-0 text-zinc-400 transition", expanded && "rotate-180")} />
                  </button>
                  {p && (
                    <button className={cn(p.cls, "btn-sm shrink-0")} disabled={busy === g.user_id} onClick={() => act(g, p.action)}>
                      {p.label}
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="space-y-3 bg-zinc-50 px-4 pb-4 pt-3 dark:bg-zinc-900/60">
                    {g.location_note && <p className="text-sm"><span aria-hidden>📍</span> {g.location_note}</p>}
                    {questions.length > 0 && (
                      <dl className="space-y-2">
                        {answered.length === 0 && <p className="text-sm text-zinc-500">No answers to your questions.</p>}
                        {answered.map((qq) => (
                          <div key={qq.id}>
                            <dt className="text-xs font-semibold text-zinc-500">{qq.label}</dt>
                            <dd className="whitespace-pre-line text-sm">{g.answers[qq.id]}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {g.status !== "going" && <button className="btn-accent btn-sm" disabled={busy === g.user_id} onClick={() => act(g, "approve")}>Approve</button>}
                      {g.status === "going" && !g.checked_in_at && <button className="btn-secondary btn-sm" disabled={busy === g.user_id} onClick={() => act(g, "checkin")}>Check in</button>}
                      {g.checked_in_at && <button className="btn-secondary btn-sm" disabled={busy === g.user_id} onClick={() => act(g, "undo")}><HIcon name="undo" className="h-4 w-4" /> Undo check-in</button>}
                      {(g.status === "pending" || g.status === "going") && !g.checked_in_at && event.waitlist_enabled && (
                        <button className="btn-secondary btn-sm" disabled={busy === g.user_id} onClick={() => act(g, "waitlist")}>Move to waitlist</button>
                      )}
                      {g.status !== "declined" && g.status !== "cancelled" && (
                        <button className="btn-ghost btn-sm text-red-600" disabled={busy === g.user_id} onClick={() => { if (confirm(`Remove ${g.profile?.name || "this guest"}? They'll be declined and checked out.`)) act(g, "decline"); }}>
                          {g.status === "pending" || g.status === "waitlist" ? "Decline" : "Remove"}
                        </button>
                      )}
                      {g.profile?.username && <Link href={`/u/${g.profile.username}`} className="btn-ghost btn-sm ml-auto">View profile</Link>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
