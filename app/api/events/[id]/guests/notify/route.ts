import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { EMAIL_EVENT_COLUMNS, emailConfigured, guestStatusEmail, resolveRecipients, type EmailEvent } from "@/lib/eventEmails";
import { sendEmail } from "@/lib/email";

/** Host-only: email one guest about a decision (approved, declined, waitlisted). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, status } = await req.json().catch(() => ({}));
  if (!userId || !["going", "declined", "waitlist"].includes(status)) {
    return NextResponse.json({ error: "userId and status (going, declined, waitlist) are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: isHost } = await supabase.rpc("is_event_organizer", { eid: id });
  if (!isHost) return NextResponse.json({ error: "Only hosts can notify guests" }, { status: 403 });
  if (!emailConfigured()) return NextResponse.json({ ok: true, emailed: false, configured: false });

  const db = createServiceClient();
  const { data: reg } = await db.from("event_registrations").select("status").eq("event_id", id).eq("user_id", userId).maybeSingle();
  if (!reg || reg.status !== status) return NextResponse.json({ error: "That guest's status has changed" }, { status: 409 });

  const { data: event } = await db.from("events").select(EMAIL_EVENT_COLUMNS).eq("id", id).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // resolveRecipients handles the contact email fallback; filter to this guest.
  const audience = status === "going" ? "going" : status === "waitlist" ? "waitlist" : null;
  let email = "";
  if (audience) {
    email = (await resolveRecipients(db, id, audience)).find((r) => r.userId === userId)?.email ?? "";
  } else {
    const { data: c } = await db.from("user_contacts").select("contact_email").eq("user_id", userId).maybeSingle();
    email = c?.contact_email || (await db.auth.admin.getUserById(userId)).data.user?.email || "";
  }
  if (!email) return NextResponse.json({ ok: true, emailed: false, configured: true });

  const { subject, html } = guestStatusEmail(event as EmailEvent, status);
  const emailed = await sendEmail({ to: email, subject, html });
  return NextResponse.json({ ok: true, emailed, configured: true });
}
