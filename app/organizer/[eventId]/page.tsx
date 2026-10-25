import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getUser } from "@/lib/supabase/server";
import { EventManager } from "@/components/c/EventManager";
import type { EventRow } from "@/lib/types";

export default async function ManageEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { supabase, user } = await getUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event || (event.organizer_id !== user!.id)) {
    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user!.id).single();
    if (!event || !me?.is_admin) notFound();
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const eventUrl = `${site}/e/${event.code}`;
  const qr = await QRCode.toDataURL(eventUrl, { width: 640, margin: 2 });

  const [{ data: stats }, { data: checkins }, { data: invites }, { data: sponsors }, { data: series }] = await Promise.all([
    supabase.rpc("event_stats", { p_event: eventId }),
    supabase.from("event_checkins").select("user_id, checked_in_at, location_note, profile:profiles(name,username,avatar_url,skills)").eq("event_id", eventId).order("checked_in_at", { ascending: false }),
    supabase.from("event_invites").select("email").eq("event_id", eventId),
    supabase.from("event_sponsors").select("*").eq("event_id", eventId).order("created_at"),
    supabase.from("event_series").select("id,name").eq("organizer_id", event.organizer_id),
  ]);

  return (
    <EventManager
      event={event as EventRow}
      userId={user!.id}
      eventUrl={eventUrl}
      qr={qr}
      stats={stats?.[0] ?? null}
      checkins={(checkins ?? []) as never}
      invites={(invites ?? []).map((i: { email: string }) => i.email)}
      sponsors={sponsors ?? []}
      series={series ?? []}
    />
  );
}
