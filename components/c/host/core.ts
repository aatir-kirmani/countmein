import type { RegistrationStatus } from "@/lib/types";

export type GuestProfile = { id: string; name: string; username: string; avatar_url: string | null; skills: string[] };

/** One row per person: their registration merged with their check-in (if any). */
export type Guest = {
  user_id: string;
  profile: GuestProfile | null;
  status: RegistrationStatus;
  answers: Record<string, string>;
  registered_at: string | null;
  checked_in_at: string | null;
  location_note: string | null;
};

export type GuestFilter = "all" | "going" | "pending" | "waitlist" | "checked_in" | "declined";

type RegRow = { user_id: string; status: RegistrationStatus; answers: Record<string, string> | null; created_at: string; profile: GuestProfile | null };
type CheckinRow = { user_id: string; checked_in_at: string; location_note: string | null; profile: GuestProfile | null };

export const GUEST_PROFILE = "id,name,username,avatar_url,skills";


export function mergeGuests(regs: RegRow[], checks: CheckinRow[]): Guest[] {
  const map = new Map<string, Guest>();
  for (const r of regs) {
    map.set(r.user_id, { user_id: r.user_id, profile: r.profile, status: r.status, answers: r.answers ?? {}, registered_at: r.created_at, checked_in_at: null, location_note: null });
  }
  for (const c of checks) {
    const g = map.get(c.user_id);
    if (g) { g.checked_in_at = c.checked_in_at; g.location_note = c.location_note; g.profile ??= c.profile; }
    else map.set(c.user_id, { user_id: c.user_id, profile: c.profile, status: "going", answers: {}, registered_at: c.checked_in_at, checked_in_at: c.checked_in_at, location_note: c.location_note });
  }
  return Array.from(map.values()).sort((a, b) => (b.checked_in_at ?? b.registered_at ?? "").localeCompare(a.checked_in_at ?? a.registered_at ?? ""));
}

export function matchesFilter(g: Guest, f: GuestFilter) {
  if (f === "all") return g.status !== "cancelled";
  if (f === "checked_in") return !!g.checked_in_at;
  return g.status === f;
}

export function countGuests(guests: Guest[]) {
  const c = { all: 0, going: 0, pending: 0, waitlist: 0, checked_in: 0, declined: 0 } as Record<GuestFilter, number>;
  for (const g of guests) (Object.keys(c) as GuestFilter[]).forEach((f) => { if (matchesFilter(g, f)) c[f]++; });
  return c;
}

/** Ticket QR contract: `${site}/e/CODE?ticket=<userId>`. */
export function parseTicket(raw: string): { code: string; userId: string | null } | null {
  try {
    const u = new URL(raw.trim());
    const m = u.pathname.match(/\/e\/([A-Za-z0-9]{6})\/?$/);
    if (!m) return null;
    const t = u.searchParams.get("ticket");
    const uuid = t && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? t : null;
    return { code: m[1].toUpperCase(), userId: uuid };
  } catch {
    return null;
  }
}

