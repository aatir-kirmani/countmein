import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function layout(title: string, body: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;color:#18181b">
<h1 style="font-size:22px;margin:0 0 16px">${title}</h1>${body}
<p style="color:#71717a;font-size:12px;margin-top:32px">Sent by Countmein</p></div>`;
}

const stat = (label: string, n: number) =>
  `<td style="padding:12px;text-align:center;border:1px solid #e4e4e7;border-radius:8px"><div style="font-size:24px;font-weight:700">${n}</div><div style="font-size:12px;color:#71717a">${label}</div></td>`;

/** Emails every attendee their personal recap and the organizer the event summary. Returns emails sent. */
export async function sendEventRecap(eventId: string): Promise<number> {
  const db = createServiceClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { data: event, error } = await db.from("events").select("id,name,code,organizer_id").eq("id", eventId).single();
  if (error || !event) throw new Error("Event not found");

  const [{ data: checkins }, { data: requests }, { data: matches }, { count: projectCount }] = await Promise.all([
    db.from("event_checkins").select("user_id").eq("event_id", eventId),
    db.from("join_requests").select("requester_id, status, direction, project:projects(name, owner_id)").eq("event_id", eventId),
    db.from("matches").select("project_id, user_id, role, project:projects(name, owner_id)").eq("event_id", eventId),
    db.from("event_projects").select("project_id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);

  type Req = { requester_id: string; status: string; direction: string; project: { name: string; owner_id: string } | null };
  type Match = { project_id: string; user_id: string; role: string; project: { name: string; owner_id: string } | null };
  const reqs = (requests ?? []) as unknown as Req[];
  const ms = (matches ?? []) as unknown as Match[];

  const userIds = Array.from(new Set([...(checkins ?? []).map((c) => c.user_id), event.organizer_id]));
  const [{ data: contacts }, { data: profiles }] = await Promise.all([
    db.from("user_contacts").select("user_id, contact_email").in("user_id", userIds),
    db.from("profiles").select("id, name").in("id", userIds),
  ]);
  const emailOf = new Map((contacts ?? []).map((c) => [c.user_id, c.contact_email as string | null]));
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.name as string]));

  let sent = 0;
  for (const c of checkins ?? []) {
    const uid = c.user_id;
    const to = emailOf.get(uid);
    if (!to) continue;
    const sentReqs = reqs.filter((r) => r.direction === "request" && r.requester_id === uid).length;
    const received = reqs.filter((r) => r.direction === "request" && r.project?.owner_id === uid).length;
    const joined = ms.filter((m) => m.user_id === uid);
    const connections = ms.filter((m) => m.user_id === uid || m.project?.owner_id === uid).length;
    const joinedList = joined.length
      ? `<p><strong>Projects you joined:</strong></p><ul>${joined.map((m) => `<li><a href="${site}/space/${m.project_id}">${esc(m.project?.name ?? "Project")}</a> as ${esc(m.role)}</li>`).join("")}</ul>`
      : "";
    const html = layout(
      `Your recap: ${esc(event.name)}`,
      `<p>Hi ${esc(nameOf.get(uid) || "there")}, thanks for coming! Here's how it went:</p>
<table style="width:100%;border-spacing:8px"><tr>${stat("Requests sent", sentReqs)}${stat("Requests received", received)}${stat("Connections", connections)}</tr></table>
${joinedList}
<p><a href="${site}/inbox" style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Open your inbox</a></p>
<p style="font-size:13px;color:#71717a">The board stays browsable for 7 days: <a href="${site}/e/${event.code}">${site}/e/${event.code}</a></p>`
    );
    await sendEmail({ to, subject: `Your Countmein recap: ${event.name}`, html });
    sent++;
  }

  const orgEmail = emailOf.get(event.organizer_id);
  if (orgEmail) {
    const html = layout(
      `Organizer recap: ${esc(event.name)}`,
      `<table style="width:100%;border-spacing:8px"><tr>${stat("Attendees", checkins?.length ?? 0)}${stat("Projects", projectCount ?? 0)}</tr>
<tr>${stat("Requests", reqs.length)}${stat("Matches", ms.length)}</tr></table>
<p><a href="${site}/api/events/${event.id}/export">Download attendee CSV</a> · <a href="${site}/organizer/${event.id}">Event dashboard</a></p>`
    );
    await sendEmail({ to: orgEmail, subject: `Organizer recap: ${event.name}`, html });
    sent++;
  }

  await db.from("events").update({ recap_sent: true }).eq("id", eventId);
  return sent;
}
