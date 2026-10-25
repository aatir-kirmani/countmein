import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendEventRecap } from "@/lib/recap";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Owners and co-hosts can send the recap.
  const { data: isHost } = await supabase.rpc("is_event_organizer", { eid: id });
  if (!isHost) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const sent = await sendEventRecap(id);
    return NextResponse.json({ sent, configured: emailConfigured() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
