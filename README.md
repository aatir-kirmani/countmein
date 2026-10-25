# Countmein

Event companion app for indie hacker meetups: check in, post what you're building, and team up with people in the room.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Realtime, Storage, RLS) · Resend · Stripe · Vercel.

## 1. Supabase

1. Create a project at https://supabase.com.
2. Apply the schema, either way:
   - **SQL editor:** paste `supabase/migrations/0001_init.sql` and run it.
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
3. **Auth → URL configuration**
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/callback`, `http://localhost:3000/auth/callback`
4. **Auth → Providers**
   - Email: enabled (magic link).
   - GitHub: create an OAuth app at https://github.com/settings/developers with callback `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the client ID and secret.
   - Google: create OAuth credentials in Google Cloud Console with the same callback URL, then paste the client ID and secret.
5. Storage: the migration creates a public `media` bucket. Nothing else to do.
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
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Only needed for paid tickets |

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

`vercel.json` registers an hourly cron at `/api/cron`. Each run expires requests 48 hours after an event ends, marks finished events as ended, and sends recap emails.

## 5. Stripe (paid tickets)

1. Set `STRIPE_SECRET_KEY`.
2. In the Stripe dashboard, add a webhook endpoint at `https://<your-domain>/api/stripe/webhook` for the `checkout.session.completed` event, then set `STRIPE_WEBHOOK_SECRET`.
3. Set a ticket price on the event. Attendees pay before they can check in.

## Security model

- Contact details live in `user_contacts`. RLS only lets you read them for yourself or for people you share a project with, which happens through an accepted request or invite.
- Boards and People tabs of unlisted and invite-only events require check-in (`can_view_board`).
- Requests and invites go through the `create_join_request` and `respond_join_request` RPCs. These enforce ownership, blocks, one open request per project, 10 requests per event, and event state.
- Project Space data (messages, tasks, links) is readable by members only.

## Pages

`/` landing · `/login` · `/onboarding` · `/e/[code]` event (Projects / People / My activity) · `/e/[code]/board` projector · `/p/[id]` project · `/u/[username]` profile · `/me` · `/inbox` · `/space/[id]` · `/organizer` · `/organizer/new` · `/organizer/[id]` · `/series/[slug]` · `/admin`
