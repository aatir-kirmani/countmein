import { notFound } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { AdminClient } from "@/components/c/AdminClient";

export default async function AdminPage() {
  const { supabase, profile } = await getProfile();
  if (!profile?.is_admin) notFound();
  const [{ data: reports }, { data: events }] = await Promise.all([
    supabase.from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(name,username)").eq("status", "open").order("created_at", { ascending: false }).limit(100),
    supabase.from("events").select("id,name,code,starts_at,visibility,organizer:profiles!events_organizer_id_fkey(name,username)").order("created_at", { ascending: false }).limit(50),
  ]);
  return <AdminClient reports={(reports ?? []) as never} events={(events ?? []) as never} />;
}
