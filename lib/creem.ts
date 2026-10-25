// Minimal Creem (creem.io) client: products, checkouts and webhook verification. Server-only.

const PROD = "https://api.creem.io";
const TEST = "https://test-api.creem.io";

export function creemConfigured() {
  return !!process.env.CREEM_API_KEY;
}

function baseUrl() {
  const key = process.env.CREEM_API_KEY ?? "";
  return key.startsWith("creem_test_") || process.env.CREEM_TEST_MODE === "true" ? TEST : PROD;
}

async function creem<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "x-api-key": process.env.CREEM_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = (json.message as string | string[] | undefined) ?? (json.error as string | undefined) ?? text;
    throw new Error(`Creem ${path} failed (${res.status}): ${Array.isArray(msg) ? msg.join(", ") : msg}`);
  }
  return json as T;
}

export type CreemProduct = { id: string; price: number; currency: string };
export type CreemCheckout = { id: string; checkout_url?: string };

export function createProduct(p: { name: string; description: string; priceCents: number; currency: string; successUrl?: string }) {
  return creem<CreemProduct>("/v1/products", {
    name: p.name.slice(0, 200),
    description: p.description.slice(0, 1000),
    price: p.priceCents,
    currency: p.currency.toUpperCase() === "EUR" ? "EUR" : "USD",
    billing_type: "onetime",
    abandoned_cart_recovery_enabled: false,
    ...(p.successUrl ? { default_success_url: p.successUrl } : {}),
  });
}

export function createCheckout(c: { productId: string; requestId: string; email?: string; successUrl: string; metadata: Record<string, string> }) {
  return creem<CreemCheckout>("/v1/checkouts", {
    product_id: c.productId,
    request_id: c.requestId,
    units: 1,
    success_url: c.successUrl,
    metadata: c.metadata,
    ...(c.email ? { customer: { email: c.email } } : {}),
  });
}

// ---------- Webhooks ----------

export class CreemSignatureError extends Error {}

const enc = new TextEncoder();
const TOLERANCE_SECONDS = 5 * 60;

async function hmac(key: Uint8Array, value: string) {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(value)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const toB64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

/**
 * Verifies a Creem webhook. Supports Standard Webhooks headers (webhook-id / webhook-timestamp /
 * webhook-signature) and the legacy `creem-signature` hex HMAC of the raw body. Throws on failure.
 */
export async function verifyCreemWebhook(rawBody: string, headers: Headers, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new CreemSignatureError("Webhook secret is not configured");
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sig = headers.get("webhook-signature");

  if (id && ts && sig) {
    const t = Number.parseInt(ts, 10);
    if (Number.isNaN(t)) throw new CreemSignatureError("Invalid webhook timestamp");
    if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) throw new CreemSignatureError("Webhook timestamp outside tolerance");
    const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
    const expected = toB64(await hmac(new Uint8Array(key), `${id}.${t}.${rawBody}`));
    const ok = sig.split(" ").some((part) => {
      const [version, value] = part.split(",");
      return version === "v1" && !!value && safeEqual(value, expected);
    });
    if (!ok) throw new CreemSignatureError("Invalid webhook signature");
    return;
  }

  const legacy = headers.get("creem-signature") ?? headers.get("x-creem-signature");
  if (!legacy) throw new CreemSignatureError("Missing webhook signature");
  const given = legacy.trim().replace(/^sha256=/, "").toLowerCase();
  const expected = toHex(await hmac(enc.encode(secret), rawBody));
  if (!safeEqual(given, expected)) throw new CreemSignatureError("Invalid webhook signature");
}

export type CreemEvent = { id?: string; type: string; object: Record<string, unknown> };

export function parseCreemEvent(rawBody: string): CreemEvent {
  const raw = JSON.parse(rawBody) as { id?: string; type?: string; eventType?: string; object?: Record<string, unknown>; data?: Record<string, unknown> };
  return { id: raw.id, type: raw.eventType ?? raw.type ?? "", object: raw.object ?? raw.data ?? {} };
}
