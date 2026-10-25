import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { emailConfigured, sendEventRecap } from "@/lib/recap";
import { EMAIL_EVENT_COLUMNS, reminderEmail, resolveRecipients, sendToAll, type EmailEvent } from "@/lib/eventEmails";

export const dynamic = "force-dynamic";

/** Daily (vercel.json): expire stale requests, update event status, send reminders and recaps once email is configured. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const now = new Date().toISOString();

  const { data: expired } = await db.rpc("expire_requests");
  await db.from("events").update({ status: "ended" }).lt("ends_at", now).neq("status", "ended");
  await db.from("events").update({ status: "live" }).lte("starts_at", now).gt("ends_at", now).eq("status", "upcoming");

  // Reminders: events starting in the next 36 hours (the cron runs daily), once per event.
  const reminders: Record<string, number | string> = {};
  if (emailConfigured()) {
    const soon = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    const { data: upcoming } = await db.from("events").select(EMAIL_EVENT_COLUMNS)
      .is("cancelled_at", null).eq("reminder_sent", false).gt("starts_at", now).lte("starts_at", soon).limit(50);
    for (const e of (upcoming ?? []) as unknown as EmailEvent[]) {
      try {
        const recipients = await resolveRecipients(db, e.id, "going");
        reminders[e.id] = await sendToAll(recipients, () => reminderEmail(e));
        await db.from("events").update({ reminder_sent: true }).eq("id", e.id);
      } catch (err) {
        reminders[e.id] = (err as Error).message;
      }
    }
  }

  const { data: toRecap } = emailConfigured()
    ? await db.from("events").select("id").eq("status", "ended").eq("recap_sent", false).is("cancelled_at", null).limit(20)
    : { data: [] as { id: string }[] };
  const recaps: Record<string, number | string> = {};
  for (const e of toRecap ?? []) {
    try { recaps[e.id] = await sendEventRecap(e.id); }
    catch (err) { recaps[e.id] = (err as Error).message; }
  }
  return NextResponse.json({ expired, reminders, recaps });
}
