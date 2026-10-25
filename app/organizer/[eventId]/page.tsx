import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { EventManager } from "@/components/c/EventManager";
import { mergeGuests } from "@/components/c/host/core";
import { loadHostEvent } from "@/components/c/host/load";
import type { EventMessage } from "@/lib/types";

const PROFILE = "id,name,username,avatar_url,skills";


export default async function ManageEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const ctx = await loadHostEvent(eventId);
  if (!ctx) notFound();
  const { supabase, user, event } = ctx;

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const eventUrl = `${site}/e/${event.code}`;
  const qr = await QRCode.toDataURL(eventUrl, { width: 640, margin: 2 });

  const [
    { data: stats }, { data: regs }, { data: checkins }, { data: invites }, { data: sponsors }, { data: series },
    { data: hosts }, { data: owner }, { data: messages }, { data: insights },
  ] = await Promise.all([
    supabase.rpc("event_stats", { p_event: eventId }),
    supabase.from("event_registrations").select(`user_id,status,answers,created_at,profile:profiles!event_registrations_user_id_fkey(${PROFILE})`).eq("event_id", eventId),
    supabase.from("event_checkins").select(`user_id,checked_in_at,location_note,profile:profiles(${PROFILE})`).eq("event_id", eventId),
    supabase.from("event_invites").select("email").eq("event_id", eventId),
    supabase.from("event_sponsors").select("*").eq("event_id", eventId).order("created_at"),
    supabase.from("event_series").select("id,name").eq("organizer_id", event.organizer_id),
    supabase.from("event_hosts").select("event_id,user_id,role,show_on_page,created_at,profile:profiles!event_hosts_user_id_fkey(id,name,username,avatar_url)").eq("event_id", eventId).order("created_at"),
    supabase.from("profiles").select("id,name,username,avatar_url").eq("id", event.organizer_id).maybeSingle(),
    supabase.from("event_messages").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
    supabase.rpc("event_insights", { p_event: eventId }),
  ]);

  return (
    <EventManager
      event={event}
      userId={user.id}
      isOwner={event.organizer_id === user.id}
      owner={owner ?? null}
      eventUrl={eventUrl}
      qr={qr}
      stats={stats?.[0] ?? null}
      guests={mergeGuests((regs ?? []) as never, (checkins ?? []) as never)}
      invites={(invites ?? []).map((i: { email: string }) => i.email)}
      sponsors={sponsors ?? []}
      series={series ?? []}
      hosts={(hosts ?? []) as never}
      messages={(messages ?? []) as EventMessage[]}
      insights={insights ?? null}
    />
  );
}
