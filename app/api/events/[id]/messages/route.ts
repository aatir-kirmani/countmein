import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AUDIENCES, EMAIL_EVENT_COLUMNS, emailConfigured, hostMessageEmail, resolveRecipients, sendToAll, type Audience, type EmailEvent } from "@/lib/eventEmails";

/** Host sends a message to guests: saved for the event page, and emailed when email is configured. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subject, body, audience = "all" } = await req.json().catch(() => ({}));
  const s = String(subject ?? "").trim();
  const b = String(body ?? "").trim();
  if (!s || s.length > 140) return NextResponse.json({ error: "Add a subject (up to 140 characters)" }, { status: 400 });
  if (!b || b.length > 4000) return NextResponse.json({ error: "Add a message (up to 4000 characters)" }, { status: 400 });
  if (!AUDIENCES.includes(audience)) return NextResponse.json({ error: "Unknown audience" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: isHost } = await supabase.rpc("is_event_organizer", { eid: id });
  if (!isHost) return NextResponse.json({ error: "Only hosts can message guests" }, { status: 403 });

  const { data: msg, error } = await supabase
    .from("event_messages")
    .insert({ event_id: id, author_id: user.id, subject: s, body: b, audience })
    .select("id")
    .single();
  if (error || !msg) return NextResponse.json({ error: error?.message ?? "Could not save the message" }, { status: 500 });

  const configured = emailConfigured();
  let emailed = 0;
  if (configured) {
    const db = createServiceClient();
    const [{ data: event }, { data: me }] = await Promise.all([
      db.from("events").select(EMAIL_EVENT_COLUMNS).eq("id", id).single(),
      db.from("profiles").select("name, username").eq("id", user.id).single(),
    ]);
    if (event) {
      const recipients = await resolveRecipients(db, id, audience as Audience, user.id);
      const host = me?.name || (me?.username ? `@${me.username}` : "The host");
      emailed = await sendToAll(recipients, () => ({ subject: `${s} · ${(event as EmailEvent).name}`, html: hostMessageEmail(event as EmailEvent, s, b, host) }));
      await db.from("event_messages").update({ emailed_count: emailed }).eq("id", msg.id);
    }
  }
  return NextResponse.json({ id: msg.id, emailed, configured });
}
