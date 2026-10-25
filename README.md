# Countmein

Event companion app for indie hacker meetups: check in, post what you're building, and team up with people in the room.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Realtime, Storage, RLS) · Resend · Creem · Vercel.

## 1. Supabase

1. Create a project at https://supabase.com.
2. Apply the schema, either way:
   - **SQL editor:** paste and run each file in `supabase/migrations/` in order (`0001_init.sql` through the highest number).
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
3. **Auth → URL configuration**
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/callback`, `http://localhost:3000/auth/callback`
4. **Auth → Providers**
   - Email: enabled (magic link).
   - GitHub: create an OAuth app at https://github.com/settings/developers with callback `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the client ID and secret.
   - Google: create OAuth credentials in Google Cloud Console with the same callback URL, then paste the client ID and secret.
5. Storage: the migration creates a public `media` bucket. Nothing else to do.
   Tests: `psql "$DATABASE_URL" -f supabase/tests/rls_test.sql` and `supabase/tests/host_test.sql` (each runs in a transaction and rolls back).
6. Realtime: the migration adds the needed tables to the `supabase_realtime` publication.

### Make yourself an admin

```sql
update profiles set is_admin = true where username = 'your-username';
```

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. Server-only, never expose. |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL, used for QR codes and emails |
| `RESEND_API_KEY`, `EMAIL_FROM` | https://resend.com. Emails are skipped when unset. |
| `CRON_SECRET` | Any long random string. Vercel Cron sends it automatically. |
| `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET` | Only needed for paid tickets (Creem dashboard) |
| `CREEM_TEST_MODE` | `true` to use Creem's test API. Automatic for keys starting with `creem_test_`. |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `true` shows the ticket price field to organizers |

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Deploy to Vercel

```bash
npx vercel link
npx vercel env add ...   # add every variable above for Production
npx vercel --prod
```

`vercel.json` registers a daily cron at `/api/cron` (03:00 UTC; Vercel Hobby allows daily crons only, Pro can switch to hourly). Each run expires requests 48 hours after an event ends, marks finished events as ended, emails going guests a reminder for events starting in the next 36 hours, and sends recap emails. Reminders and recaps are only sent (and events only marked as reminded or recapped) once `RESEND_API_KEY` is set, so nothing is lost if you add email later. Organizers can also send a recap any time from the event dashboard.

## 5. Creem (paid tickets)

Creem is the merchant of record, so it handles tax and receipts.

1. In the Creem dashboard, open **Developers** and copy your API key into `CREEM_API_KEY`. Use a test key (`creem_test_...`) first; the app switches to `https://test-api.creem.io` automatically.
2. Add a webhook endpoint at `https://<your-domain>/api/creem/webhook` subscribed to `checkout.completed` and `refund.created`, then copy its signing secret into `CREEM_WEBHOOK_SECRET`.
3. Set `NEXT_PUBLIC_PAYMENTS_ENABLED=true` and redeploy so organizers can set a ticket price.
4. Apply `supabase/migrations/0004_creem.sql`.

How it works: the first ticket purchase for an event creates a one-time Creem product at the event's price (a new one is created if the price changes later). `POST /api/tickets/checkout` creates a checkout with the ticket id as `request_id` and redirects the attendee. When Creem calls the webhook, the ticket is marked paid and the attendee can check in. Refunds mark the ticket refunded.

## Host controls

Hosts (the event creator plus any co-hosts added on the manage page) can:

- **Registration:** require approval, cap capacity with an optional waitlist (spots fill in order when someone cancels), open or close registration, ask up to 10 registration questions, and show or hide the guest list on the event page. Walk-ins who scan the door QR are registered automatically when no approval or required questions apply.
- **Guests:** approve, decline, waitlist, approve all, check guests in at the door, and undo check-ins. Guests can be emailed about each decision.
- **Messages:** post an update to all guests or one group (going, checked in, pending, waitlist). Updates appear on the event page and are emailed when Resend is configured. Changing the time or place offers to send one automatically.
- **Lifecycle:** set the event time zone, duplicate an event to new dates, cancel with a reason (guests are notified), and see insights (page views, registrations by status and day, check-ins, projects, requests, matches).

Database rules for all of this live in `supabase/migrations/0006_host_controls.sql`; `supabase/tests/host_test.sql` covers them.

API routes: `POST /api/events/[id]/messages`, `POST /api/events/[id]/cancel`, `POST /api/events/[id]/guests/notify`.

## Security model

- Contact details live in `user_contacts`. RLS only lets you read them for yourself or for people you share a project with, which happens through an accepted request or invite.
- Boards and People tabs of unlisted and invite-only events require check-in (`can_view_board`).
- Requests and invites go through the `create_join_request` and `respond_join_request` RPCs. These enforce ownership, blocks, one open request per project, 10 requests per event, and event state.
- Project Space data (messages, tasks, links) is readable by members only.
- Registrations and their answers are visible only to the guest and the event's hosts. Host messages are visible only to hosts and to guests in the message's audience. Co-hosts can manage an event but only the creator can delete it or change the team.

## Pages

`/` landing · `/login` · `/onboarding` · `/e/[code]` event (Projects / People / My activity) · `/e/[code]/board` projector · `/p/[id]` project · `/u/[username]` profile · `/me` · `/inbox` · `/space/[id]` · `/organizer` · `/organizer/new` · `/organizer/[id]` · `/organizer/[id]/poster` (printable door poster) · `/series/[slug]` · `/admin`
