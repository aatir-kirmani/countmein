import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CreemSignatureError, parseCreemEvent, verifyCreemWebhook } from "@/lib/creem";

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

export async function POST(req: Request) {
  const raw = await req.text();
  try {
    await verifyCreemWebhook(raw, req.headers, process.env.CREEM_WEBHOOK_SECRET ?? "");
  } catch (e) {
    const msg = e instanceof CreemSignatureError ? e.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let event;
  try { event = parseCreemEvent(raw); } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }); }

  const admin = createServiceClient();
  const o = event.object;

  if (event.type === "checkout.completed") {
    const meta = obj(o.metadata);
    const ticketId = str(meta.ticket_id) ?? str(o.request_id);
    const checkoutId = str(o.id);
    const orderId = str(obj(o.order).id);
    const patch = { status: "paid", paid_at: new Date().toISOString(), creem_order_id: orderId, ...(checkoutId ? { creem_checkout_id: checkoutId } : {}) };
    // Idempotent: only moves pending tickets to paid; a repeat delivery is a no-op.
    let q = admin.from("event_tickets").update(patch).neq("status", "paid");
    if (ticketId) q = q.eq("id", ticketId);
    else if (checkoutId) q = q.eq("creem_checkout_id", checkoutId);
    else return NextResponse.json({ received: true, matched: false });
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ received: true });
  }

  if (event.type === "refund.created") {
    const checkout = obj(o.checkout);
    const order = obj(o.order);
    const meta = { ...obj(checkout.metadata), ...obj(o.metadata) };
    const ticketId = str(meta.ticket_id) ?? str(checkout.request_id);
    const checkoutId = str(checkout.id) ?? (typeof o.checkout === "string" ? o.checkout : null);
    const orderId = str(order.id) ?? (typeof o.order === "string" ? o.order : null);
    let q = admin.from("event_tickets").update({ status: "refunded" });
    if (ticketId) q = q.eq("id", ticketId);
    else if (checkoutId) q = q.eq("creem_checkout_id", checkoutId);
    else if (orderId) q = q.eq("creem_order_id", orderId);
    else return NextResponse.json({ received: true, matched: false });
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true, ignored: event.type });
}
