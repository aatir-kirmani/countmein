"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { QrScanner } from "@/components/QrScanner";
import { Avatar } from "@/components/ui/Avatar";
import { cn, timeAgo } from "@/lib/utils";
import { fmtRangeInZone } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import { parseTicket, type Guest, type GuestProfile } from "./core";
import { useGuests } from "./guests";
import { GuestStatusChip, HIcon } from "./ui";

type Result =
  | { kind: "checked"; profile: GuestProfile | null }
  | { kind: "already"; profile: GuestProfile | null; at: string }
  | { kind: "added"; profile: GuestProfile | null; was: string }
  | { kind: "wrong"; code: string }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

const TONE: Record<Result["kind"], string> = {
  checked: "bg-lime-300 text-zinc-900",
  added: "bg-amber-300 text-amber-950",
  already: "bg-sky-200 text-sky-950",
  wrong: "bg-red-500 text-white",
  invalid: "bg-red-500 text-white",
  error: "bg-red-500 text-white",
};

const rank = (g: Guest) => (g.checked_in_at ? 2 : g.status === "going" ? 0 : 1);

export function CheckinClient({ event, initial }: { event: EventRow; initial: Guest[] }) {
  const supabase = createClient();
  const { toast } = useApp();
  const { guests, setGuests } = useGuests(event.id, initial);
  const guestsRef = useRef(guests);
  guestsRef.current = guests;
  const [result, setResult] = useState<Result | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkedIn = guests.filter((g) => g.checked_in_at).length;
  const expected = guests.filter((g) => g.status === "going").length;

  const show = (r: Result) => {
    setResult(r);
    navigator.vibrate?.(r.kind === "checked" ? 60 : r.kind === "added" || r.kind === "already" ? [40, 60, 40] : [200]);
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => setResult(null), 4500);
  };

  const checkIn = async (userId: string) => {
    const known = guestsRef.current.find((g) => g.user_id === userId) ?? null;
    if (known?.checked_in_at) return show({ kind: "already", profile: known.profile, at: known.checked_in_at });
    let profile = known?.profile ?? null;
    if (!profile) {
      const { data } = await supabase.from("profiles").select("id,name,username,avatar_url,skills").eq("id", userId).maybeSingle();
      profile = (data as GuestProfile) ?? null;
      if (!profile) return show({ kind: "invalid" });
    }
    const { error } = await supabase.rpc("host_check_in", { p_event: event.id, p_user: userId });
    if (error) return show({ kind: "error", message: error.message });
    const now = new Date().toISOString();
    setGuests((gs) => known
      ? gs.map((g) => (g.user_id === userId ? { ...g, status: "going", checked_in_at: now } : g))
      : [{ user_id: userId, profile, status: "going", answers: {}, registered_at: now, checked_in_at: now, location_note: null }, ...gs]);
    if (known?.status === "going") show({ kind: "checked", profile });
    else show({ kind: "added", profile, was: known?.status ?? "not registered" });
  };

  const onScan = async (raw: string) => {
    const t = parseTicket(raw);
    if (!t) { show({ kind: "invalid" }); return false; }
    if (t.code !== event.code) { show({ kind: "wrong", code: t.code }); return false; }
    if (!t.userId) { show({ kind: "invalid" }); return false; }
    await checkIn(t.userId);
    return true;
  };

  const manual = async (g: Guest) => {
    setBusy(g.user_id);
    if (g.checked_in_at) {
      const before = g.checked_in_at;
      setGuests((gs) => gs.map((x) => (x.user_id === g.user_id ? { ...x, checked_in_at: null } : x)));
      const { error } = await supabase.rpc("host_undo_check_in", { p_event: event.id, p_user: g.user_id });
      if (error) { setGuests((gs) => gs.map((x) => (x.user_id === g.user_id ? { ...x, checked_in_at: before } : x))); toast(error.message, { kind: "error" }); }
    } else {
      await checkIn(g.user_id);
    }
    setBusy(null);
  };

  const q = query.trim().toLowerCase();
  const list = useMemo(() => guests
    .filter((g) => g.status !== "cancelled" && g.status !== "declined")
    .filter((g) => !q || [g.profile?.name, g.profile?.username].some((v) => v?.toLowerCase().includes(q)))
    // Expected guests first, then pending and waitlist, then people already inside.
    .sort((a, b) => rank(a) - rank(b) || (a.profile?.name ?? "").localeCompare(b.profile?.name ?? "")),
  [guests, q]);

  const name = (p: GuestProfile | null) => p?.name || (p?.username ? `@${p.username}` : "Guest");

  return (
    <div className="space-y-5 pt-2">
      <Link href={`/organizer/${event.id}?tab=guests`} className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
        <span aria-hidden>←</span> Back to event
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Door check-in</p>
          <h1 className="mt-1 truncate text-3xl font-extrabold">{event.name}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{fmtRangeInZone(event.starts_at, event.ends_at, event.timezone || "UTC")}</p>
        </div>
        <div className="rounded-3xl bg-lime-300 px-4 py-3 text-zinc-900">
          <p className="font-display text-3xl font-extrabold leading-none tabular-nums">{checkedIn}<span className="text-lg text-zinc-700">/{Math.max(expected, checkedIn)}</span></p>
          <p className="text-xs font-bold">checked in</p>
        </div>
      </header>

      <div className="relative">
        <QrScanner onResult={onScan} prompt="Scan the QR code on a guest's ticket." fallback="Check guests in by name below." />
        {result && (
          <div role="status" aria-live="assertive" className={cn("absolute inset-x-3 top-3 z-10 animate-pop rounded-3xl p-4 shadow-2xl sm:inset-x-6", TONE[result.kind])}>
            {"profile" in result ? (
              <div className="flex items-center gap-3">
                <Avatar src={result.profile?.avatar_url} name={result.profile?.name ?? ""} size={52} />
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-extrabold">{name(result.profile)}</p>
                  <p className="text-sm font-semibold">
                    {result.kind === "checked" && "Checked in. Welcome!"}
                    {result.kind === "already" && `Already checked in ${timeAgo(result.at)}`}
                    {result.kind === "added" && `Wasn't on the list (${result.was}). Checked in anyway.`}
                  </p>
                </div>
                <span className="ml-auto text-3xl" aria-hidden>{result.kind === "checked" ? "✅" : result.kind === "already" ? "👋" : "⚠️"}</span>
              </div>
            ) : (
              <p className="font-bold">
                {result.kind === "wrong" && `That ticket is for another event (${result.code}).`}
                {result.kind === "invalid" && "That isn't a Countmein ticket. Ask the guest to open their ticket on the event page."}
                {result.kind === "error" && result.message}
              </p>
            )}
          </div>
        )}
      </div>

      <section aria-label="Guest list" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Check in by name</h2>
          <span className="text-sm text-zinc-500">{list.length} on the list</span>
        </div>
        <label className="relative block">
          <span className="sr-only">Search guests</span>
          <HIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input className="input pl-10" type="search" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {list.length === 0 ? (
          <p className="rounded-3xl bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:bg-zinc-900/60">{q ? `No one matches "${query}".` : "No registered guests yet."}</p>
        ) : (
          <ul className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {list.map((g) => (
              <li key={g.user_id} className="flex items-center gap-3 p-3.5">
                <Avatar src={g.profile?.avatar_url} name={g.profile?.name ?? ""} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{name(g.profile)}</p>
                  <GuestStatusChip guest={g} className="mt-0.5 py-0.5 text-[11px]" />
                </div>
                <button
                  className={cn("btn-sm shrink-0", g.checked_in_at ? "btn-ghost" : g.status === "going" ? "btn-accent" : "btn-secondary")}
                  disabled={busy === g.user_id} onClick={() => manual(g)}
                >
                  {g.checked_in_at ? "Undo" : g.status === "going" ? "Check in" : "Check in anyway"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
