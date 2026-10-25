import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";
import { ProjectorBoard } from "@/components/b/ProjectorBoard";

export const metadata = { title: "Live Board · Countmein" };

export default async function BoardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const { supabase } = await getUser();
  const { data: found } = await supabase.rpc("event_by_code", { p_code: code });
  const meta = (found as { id: string; can_view: boolean }[] | null)?.[0];
  const { data: event } = meta?.can_view ? await supabase.from("events").select("*").eq("id", meta.id).single() : { data: null };
  const { data: sponsors } = event ? await supabase.from("event_sponsors").select("id,name,logo_url").eq("event_id", event.id) : { data: [] };

  if (!event) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
        <p className="text-2xl font-bold">Board not available</p>
        <Link href={`/login?next=/e/${code}/board`} className="btn-primary">Sign in as organizer</Link>
      </div>
    );
  }
  return <ProjectorBoard event={event as EventRow} sponsors={(sponsors ?? []) as { id: string; name: string; logo_url: string | null }[]} />;
}
