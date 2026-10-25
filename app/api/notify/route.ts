import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";

const OFFLINE_MS = 2 * 60 * 1000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await req.json().catch(() => ({}));
  if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });

  const admin = createServiceClient();
  const { data: r } = await admin
    .from("join_requests")
    .select("*, project:projects(id,name,owner_id), slot:project_slots(specialty)")
    .eq("id", requestId)
    .single();
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerId: string = r.project.owner_id;
  const candId: string = r.requester_id;
  if (user.id !== ownerId && user.id !== candId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Recipient is whoever did NOT just act.
  const recipientId = user.id === ownerId ? candId : ownerId;
  const [{ data: recipient }, { data: actor }, { data: contact }] = await Promise.all([
    admin.from("profiles").select("name,last_seen_at").eq("id", recipientId).single(),
    admin.from("profiles").select("name").eq("id", user.id).single(),
    admin.from("user_contacts").select("contact_email").eq("user_id", recipientId).single(),
  ]);
  if (!recipient || !contact?.contact_email) return NextResponse.json({ sent: false });
  if (Date.now() - new Date(recipient.last_seen_at).getTime() < OFFLINE_MS) return NextResponse.json({ sent: false, reason: "online" });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const who = escapeHtml(actor?.name || "Someone");
  const proj = escapeHtml(r.project.name);
  const role = r.slot?.specialty ? ` as ${escapeHtml(r.slot.specialty)}` : "";
  let subject = "";
  let body = "";
  switch (r.status) {
    case "pending":
      if (r.direction === "request") { subject = `${actor?.name || "Someone"} wants to join ${r.project.name}`; body = `${who} tapped “Count me in” on <b>${proj}</b>${role}.${r.message ? `<blockquote>${escapeHtml(r.message)}</blockquote>` : ""}`; }
      else { subject = `You're invited to join ${r.project.name}`; body = `${who} invited you to join <b>${proj}</b>${role}.`; }
      break;
    case "accepted": subject = `You're in: ${r.project.name}`; body = `${who} accepted. You can now see each other's contact details and use the project space.`; break;
    case "interested": subject = `Let's talk first: ${r.project.name}`; body = `${who} would like to meet in person first. Open your inbox for their location.`; break;
    case "declined": subject = `Update on ${r.project.name}`; body = `${who} declined this time${r.decline_reason ? `: ${escapeHtml(r.decline_reason)}` : "."}`; break;
    default: return NextResponse.json({ sent: false });
  }
  const sent = await sendEmail({ to: contact.contact_email, subject, html: emailLayout(subject, body, `${site}/inbox`, "Open inbox") });
  return NextResponse.json({ sent });
}
