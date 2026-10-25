import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Projects can only be shown at an event you're checked in to (enforced by RLS).
 * Resolve ?event=CODE up front and send people to the event page to check in first,
 * instead of saving the project and then failing to attach it.
 */
export async function resolveEventForPosting(supabase: SupabaseClient, userId: string, raw?: string) {
  const code = raw?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (!code) return null;
  const { data } = await supabase.rpc("event_by_code", { p_code: code });
  const ev = (data as { id: string; name: string; can_view: boolean }[] | null)?.[0];
  if (!ev || !ev.can_view) return null;
  const { data: checkin } = await supabase.from("event_checkins").select("id").eq("event_id", ev.id).eq("user_id", userId).maybeSingle();
  if (!checkin) redirect(`/e/${code}?checkin=1`);
  return { code, name: ev.name };
}
