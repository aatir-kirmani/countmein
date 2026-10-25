import { notFound } from "next/navigation";
import { loadHostEvent } from "@/components/c/host/load";
import { GUEST_PROFILE, mergeGuests } from "@/components/c/host/core";
import { CheckinClient } from "@/components/c/host/CheckinClient";

export const metadata = { title: "Check-in · Countmein" };

export default async function CheckinPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const ctx = await loadHostEvent(eventId);
  if (!ctx) notFound();
  const { supabase, event } = ctx;
  const [{ data: regs }, { data: checkins }] = await Promise.all([
    supabase.from("event_registrations").select(`user_id,status,answers,created_at,profile:profiles!event_registrations_user_id_fkey(${GUEST_PROFILE})`).eq("event_id", eventId),
    supabase.from("event_checkins").select(`user_id,checked_in_at,location_note,profile:profiles(${GUEST_PROFILE})`).eq("event_id", eventId),
  ]);
  return <CheckinClient event={event} initial={mergeGuests((regs ?? []) as never, (checkins ?? []) as never)} />;
}
