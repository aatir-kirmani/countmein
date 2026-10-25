import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEventRecap } from "@/lib/recap";

export const dynamic = "force-dynamic";

/** Hourly: expire stale requests, close finished events, send recaps. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const now = new Date().toISOString();

  const { data: expired } = await db.rpc("expire_requests");
  await db.from("events").update({ status: "ended" }).lt("ends_at", now).neq("status", "ended");
  await db.from("events").update({ status: "live" }).lte("starts_at", now).gt("ends_at", now).eq("status", "upcoming");

  const { data: toRecap } = await db.from("events").select("id").eq("status", "ended").eq("recap_sent", false).limit(20);
  const recaps: Record<string, number | string> = {};
  for (const e of toRecap ?? []) {
    try { recaps[e.id] = await sendEventRecap(e.id); }
    catch (err) { recaps[e.id] = (err as Error).message; }
  }
  return NextResponse.json({ expired, recaps });
}
