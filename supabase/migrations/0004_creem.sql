-- Paid tickets via Creem (replaces Stripe).
alter table public.events add column if not exists creem_product_id text;
alter table public.events add column if not exists creem_product_price_cents int;

alter table public.event_tickets add column if not exists creem_checkout_id text unique;
alter table public.event_tickets add column if not exists creem_order_id text;
alter table public.event_tickets add column if not exists paid_at timestamptz;
alter table public.event_tickets drop column if exists stripe_session_id;

comment on table public.event_tickets is 'Written by the server (service role) after Creem confirms payment via webhook.';
