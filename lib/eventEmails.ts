import type { SupabaseClient } from "@supabase/supabase-js";
import { emailLayout as baseLayout, escapeHtml, sendEmail } from "@/lib/email";
import { fmtRangeInZone, googleCalendarUrl } from "@/lib/time";
import { directionsHref } from "@/lib/utils";

export type Audience = "all" | "going" | "checked_in" | "pending" | "waitlist";
export const AUDIENCES: Audience[] = ["all", "going", "checked_in", "pending", "waitlist"];

export type EmailEvent = {
  id: string; name: string; code: string; starts_at: string; ends_at: string; timezone: string | null;
  venue: string | null; city: string | null; maps_url: string | null; location_details: string | null; description?: string | null;
};

export const EMAIL_EVENT_COLUMNS = "id,name,code,starts_at,ends_at,timezone,venue,city,maps_url,location_details,description";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const eventUrl = (e: Pick<EmailEvent, "code">) => `${siteUrl()}/e/${e.code}`;

const GUEST_FOOTER = "You are getting this because you registered for an event on Countmein.";
const emailLayout = (title: string, body: string, href?: string, label?: string) => baseLayout(title, body, href, label, GUEST_FOOTER);

const nl2br = (s: string) => escapeHtml(s).replace(/\n/g, "<br>");

/** When, where and how to get there, as an email card. */
export function eventDetailsHtml(e: EmailEvent, opts: { calendar?: boolean } = {}) {
  const when = fmtRangeInZone(e.starts_at, e.ends_at, e.timezone || "UTC");
  const where = [e.venue, e.city].filter(Boolean).join(", ");
  const maps = directionsHref(e);
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#71717a;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;font-size:14px;color:#18181b">${value}</td></tr>`;
  const links = [
    maps ? `<a href="${maps}" style="color:#6d28d9;font-weight:600">Get directions</a>` : "",
    opts.calendar ? `<a href="${googleCalendarUrl(e, eventUrl(e))}" style="color:#6d28d9;font-weight:600">Add to Google Calendar</a>` : "",
  ].filter(Boolean).join(" &nbsp;&middot;&nbsp; ");
  return `<div style="margin:18px 0 0;padding:14px 16px;border-radius:14px;background:#fafafa;border:1px solid #e4e4e7">
  <p style="margin:0 0 6px;font-weight:800;font-size:15px;color:#18181b">${escapeHtml(e.name)}</p>
  <table style="border-collapse:collapse">${row("When", escapeHtml(when))}${where ? row("Where", escapeHtml(where)) : ""}${e.location_details ? row("Finding it", nl2br(e.location_details)) : ""}</table>
  ${links ? `<p style="margin:10px 0 0;font-size:14px">${links}</p>` : ""}
</div>`;
}

export function hostMessageEmail(e: EmailEvent, subject: string, body: string, hostName: string) {
  return emailLayout(
    escapeHtml(subject),
    `<p style="margin:0 0 4px;color:#71717a;font-size:13px">A message from ${escapeHtml(hostName)}, host of ${escapeHtml(e.name)}</p>
     <p style="margin:12px 0 0">${nl2br(body)}</p>${eventDetailsHtml(e)}`,
    eventUrl(e), "Open the event",
  );
}

export function cancelledEmail(e: EmailEvent, reason: string | null) {
  return emailLayout(
    `${escapeHtml(e.name)} has been cancelled`,
    `<p style="margin:0">Sorry, the host has cancelled this event.</p>
     ${reason ? `<p style="margin:12px 0 0;padding:12px 14px;border-left:3px solid #6d28d9;background:#f5f3ff;border-radius:8px">${nl2br(reason)}</p>` : ""}
     ${eventDetailsHtml(e)}
     <p style="margin:16px 0 0">Your projects and connections on Countmein are not affected.</p>`,
    eventUrl(e), "See the event page",
  );
}

export function guestStatusEmail(e: EmailEvent, status: "going" | "declined" | "waitlist") {
  if (status === "going") {
    return {
      subject: `You're in: ${e.name}`,
      html: emailLayout(
        "You're in! 🎉",
        `<p style="margin:0">The host approved your spot. When you arrive, scan the QR code at the door or open the event and tap Check in.</p>${eventDetailsHtml(e, { calendar: true })}`,
        eventUrl(e), "Open the event",
      ),
    };
  }
  if (status === "waitlist") {
    return {
      subject: `You're on the waitlist for ${e.name}`,
      html: emailLayout(
        "You're on the waitlist",
        `<p style="margin:0">The event is full right now. We'll email you if a spot opens up.</p>${eventDetailsHtml(e)}`,
        eventUrl(e), "Open the event",
      ),
    };
  }
  return {
    subject: `Update on your registration for ${e.name}`,
    html: emailLayout(
      "Your registration wasn't approved",
      `<p style="margin:0">The host couldn't fit you in this time. There are more meetups coming, and your profile and projects are still on Countmein.</p>${eventDetailsHtml(e)}`,
      siteUrl(), "Find other events",
    ),
  };
}

export function reminderEmail(e: EmailEvent) {
  return {
    subject: `Reminder: ${e.name}`,
    html: emailLayout(
      "See you soon 👋",
      `<p style="margin:0">Quick reminder that you're going to <b>${escapeHtml(e.name)}</b>. Bring your laptop and what you're building.</p>
       ${eventDetailsHtml(e, { calendar: true })}
       <p style="margin:16px 0 0">Tip: post your project before you arrive so people can find you on the live board.</p>`,
      eventUrl(e), "Open the event",
    ),
  };
}

export type Recipient = { userId: string; email: string; name: string };

/** Guests for an audience, with their contact email (falls back to the account email). Service client only. */
export async function resolveRecipients(db: SupabaseClient, eventId: string, audience: Audience, excludeUserId?: string): Promise<Recipient[]> {
  const ids = new Set<string>();
  if (audience !== "checked_in") {
    const statuses = audience === "all" ? ["going", "pending", "waitlist"] : audience === "going" ? ["going"] : [audience];
    const { data } = await db.from("event_registrations").select("user_id").eq("event_id", eventId).in("status", statuses);
    (data ?? []).forEach((r: { user_id: string }) => ids.add(r.user_id));
  }
  if (audience === "all" || audience === "going" || audience === "checked_in") {
    const { data } = await db.from("event_checkins").select("user_id").eq("event_id", eventId);
    (data ?? []).forEach((r: { user_id: string }) => ids.add(r.user_id));
  }
  if (excludeUserId) ids.delete(excludeUserId);
  const list = Array.from(ids);
  if (!list.length) return [];

  const [{ data: contacts }, { data: profiles }] = await Promise.all([
    db.from("user_contacts").select("user_id, contact_email").in("user_id", list),
    db.from("profiles").select("id, name, banned").in("id", list),
  ]);
  const emailOf = new Map((contacts ?? []).map((c: { user_id: string; contact_email: string | null }) => [c.user_id, c.contact_email]));
  const prof = new Map((profiles ?? []).map((p: { id: string; name: string; banned: boolean }) => [p.id, p]));

  const out: Recipient[] = [];
  for (const id of list) {
    if (prof.get(id)?.banned) continue;
    let email = emailOf.get(id) || "";
    if (!email) {
      const { data } = await db.auth.admin.getUserById(id);
      email = data.user?.email ?? "";
    }
    if (email) out.push({ userId: id, email, name: prof.get(id)?.name ?? "" });
  }
  return out;
}

/** Sends in small batches. Returns how many were accepted by the provider. */
export async function sendToAll(recipients: Recipient[], build: (r: Recipient) => { subject: string; html: string }) {
  if (!emailConfigured()) return 0;
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 8) {
    const batch = recipients.slice(i, i + 8);
    const results = await Promise.all(batch.map((r) => sendEmail({ to: r.email, ...build(r) })));
    sent += results.filter(Boolean).length;
  }
  return sent;
}
