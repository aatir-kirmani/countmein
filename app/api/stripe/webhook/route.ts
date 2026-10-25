import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return NextResponse.json({ error: "Payments are not configured" }, { status: 501 });
  const stripe = new Stripe(key);
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const admin = createServiceClient();
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status === "paid" && s.metadata?.event_id && s.metadata?.user_id) {
      await admin.from("event_tickets").upsert(
        { event_id: s.metadata.event_id, user_id: s.metadata.user_id, stripe_session_id: s.id, status: "paid" },
        { onConflict: "event_id,user_id" }
      );
    }
  } else if (event.type === "charge.refunded") {
    const c = event.data.object as Stripe.Charge;
    const sessions = await stripe.checkout.sessions.list({ payment_intent: c.payment_intent as string, limit: 1 });
    const id = sessions.data[0]?.id;
    if (id) await admin.from("event_tickets").update({ status: "refunded" }).eq("stripe_session_id", id);
  }
  return NextResponse.json({ received: true });
}
