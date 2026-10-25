import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createCheckout, createProduct, creemConfigured } from "@/lib/creem";
import { eventStatus } from "@/lib/utils";

export async function POST(req: Request) {
  if (!creemConfigured()) return NextResponse.json({ error: "Payments aren't set up yet" }, { status: 501 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const { eventId } = await req.json().catch(() => ({}));
  if (!eventId) return NextResponse.json({ error: "Missing event" }, { status: 400 });

  // Read through the user's client so event visibility rules apply.
  const { data: event } = await supabase
    .from("events")
    .select("id,name,code,description,starts_at,ends_at,status,ticket_price_cents,currency,creem_product_id,creem_product_price_cents")
    .eq("id", eventId)
    .single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.ticket_price_cents <= 0) return NextResponse.json({ error: "This event is free" }, { status: 400 });
  if (eventStatus(event) === "ended") return NextResponse.json({ error: "This event has ended" }, { status: 400 });

  const admin = createServiceClient();
  const { data: existing } = await admin.from("event_tickets").select("id,status").eq("event_id", event.id).eq("user_id", user.id).maybeSingle();
  if (existing?.status === "paid") return NextResponse.json({ error: "You already have a ticket" }, { status: 409 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const successUrl = `${site}/e/${event.code}?ticket=success`;

  try {
    // Reuse the event's Creem product unless the price changed since it was created.
    let productId: string | null = event.creem_product_id;
    if (!productId || event.creem_product_price_cents !== event.ticket_price_cents) {
      const product = await createProduct({
        name: `Ticket: ${event.name}`,
        description: `Entry to ${event.name} on Countmein (event code ${event.code}).`,
        priceCents: event.ticket_price_cents,
        currency: event.currency,
        successUrl,
      });
      productId = product.id;
      await admin.from("events").update({ creem_product_id: productId, creem_product_price_cents: event.ticket_price_cents }).eq("id", event.id);
    }

    const { data: ticket, error: tErr } = await admin
      .from("event_tickets")
      .upsert({ event_id: event.id, user_id: user.id, status: "pending" }, { onConflict: "event_id,user_id" })
      .select("id")
      .single();
    if (tErr || !ticket) throw new Error(tErr?.message ?? "Could not create ticket");

    const checkout = await createCheckout({
      productId,
      requestId: ticket.id,
      email: user.email ?? undefined,
      successUrl,
      metadata: { ticket_id: ticket.id, event_id: event.id, user_id: user.id },
    });
    if (!checkout.checkout_url) throw new Error("Creem did not return a checkout URL");

    await admin.from("event_tickets").update({ creem_checkout_id: checkout.id }).eq("id", ticket.id);
    return NextResponse.json({ url: checkout.checkout_url });
  } catch (e) {
    console.error("[tickets/checkout]", e);
    return NextResponse.json({ error: "We couldn't start checkout. Please try again in a moment." }, { status: 502 });
  }
}
