import { getUser } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

/** Loads everything the host console needs. Owners, co-hosts and admins can open it. */
export async function loadHostEvent(eventId: string) {
  const { supabase, user } = await getUser();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return null;
  const [{ data: isHost }, { data: me }] = await Promise.all([
    supabase.rpc("is_event_organizer", { eid: eventId }),
    supabase.from("profiles").select("is_admin").eq("id", user!.id).single(),
  ]);
  if (!isHost && !me?.is_admin) return null;
  return { supabase, user: user!, event: event as EventRow };
}
