"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GUEST_PROFILE, mergeGuests, type Guest } from "./core";


type RegRow = Parameters<typeof mergeGuests>[0][number];
type CheckinRow = Parameters<typeof mergeGuests>[1][number];

export async function fetchGuests(eventId: string): Promise<Guest[]> {
  const supabase = createClient();
  const [{ data: regs }, { data: checks }] = await Promise.all([
    supabase.from("event_registrations").select(`user_id,status,answers,created_at,profile:profiles!event_registrations_user_id_fkey(${GUEST_PROFILE})`).eq("event_id", eventId),
    supabase.from("event_checkins").select(`user_id,checked_in_at,location_note,profile:profiles(${GUEST_PROFILE})`).eq("event_id", eventId),
  ]);
  return mergeGuests((regs ?? []) as unknown as RegRow[], (checks ?? []) as unknown as CheckinRow[]);
}

/** Guests for an event, kept fresh with realtime changes to registrations and check-ins. */
export function useGuests(eventId: string, initial: Guest[]) {
  const [guests, setGuests] = useState<Guest[]>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try { setGuests(await fetchGuests(eventId)); } catch { /* keep what we have */ }
  }, [eventId]);

  useEffect(() => {
    const supabase = createClient();
    const later = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(refresh, 400); };
    const ch = supabase
      .channel(`host-guests:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations", filter: `event_id=eq.${eventId}` }, later)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_checkins", filter: `event_id=eq.${eventId}` }, later)
      .subscribe();
    return () => { if (timer.current) clearTimeout(timer.current); supabase.removeChannel(ch); };
  }, [eventId, refresh]);

  return { guests, setGuests, refresh };
}

/** Fire-and-forget email to a guest after a host decision. Missing route or email setup is fine. */
export function notifyGuest(eventId: string, userId: string, status: string) {
  fetch(`/api/events/${eventId}/guests/notify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, status }) }).catch(() => {});
}
