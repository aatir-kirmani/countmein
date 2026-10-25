import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { EMAIL_EVENT_COLUMNS, cancelledEmail, emailConfigured, resolveRecipients, sendToAll, type EmailEvent } from "@/lib/eventEmails";

/** Host cancels the event, posts a notice on the event page and optionally emails registered guests. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reason, notify = true } = await req.json().catch(() => ({}));
  const why = String(reason ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { error } = await supabase.rpc("cancel_event", { p_event: id, p_reason: why });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  await supabase.from("event_messages").insert({
    event_id: id, author_id: user.id, subject: "Event cancelled",
    body: why ?? "The host has cancelled this event.", audience: "all",
  });

  let emailed = 0;
  if (notify && emailConfigured()) {
    const db = createServiceClient();
    const { data: event } = await db.from("events").select(EMAIL_EVENT_COLUMNS).eq("id", id).single();
    if (event) {
      const recipients = await resolveRecipients(db, id, "all", user.id);
      emailed = await sendToAll(recipients, () => ({ subject: `Cancelled: ${(event as EmailEvent).name}`, html: cancelledEmail(event as EmailEvent, why) }));
    }
  }
  return NextResponse.json({ ok: true, emailed });
}
