import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments are not configured" }, { status: 501 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await req.json().catch(() => ({}));
  const { data: event } = await supabase.from("events").select("id,name,code,ticket_price_cents,currency").eq("id", eventId).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.ticket_price_cents <= 0) return NextResponse.json({ error: "This event is free" }, { status: 400 });

  const admin = createServiceClient();
  const { data: existing } = await admin.from("event_tickets").select("status").eq("event_id", event.id).eq("user_id", user.id).maybeSingle();
  if (existing?.status === "paid") return NextResponse.json({ error: "You already have a ticket" }, { status: 400 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: event.currency, unit_amount: event.ticket_price_cents, product_data: { name: `Ticket: ${event.name}` } } }],
    customer_email: user.email,
    metadata: { event_id: event.id, user_id: user.id },
    success_url: `${site}/e/${event.code}?paid=1`,
    cancel_url: `${site}/e/${event.code}`,
  });
  await admin.from("event_tickets").upsert(
    { event_id: event.id, user_id: user.id, stripe_session_id: session.id, status: "pending" },
    { onConflict: "event_id,user_id" }
  );
  return NextResponse.json({ url: session.url });
}
