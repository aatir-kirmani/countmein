import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { TicketCode } from "@/components/landing/TicketCode";
import { LivePhone } from "@/components/landing/LivePhone";
import { RotatingSnack } from "@/components/landing/RotatingSnack";
import { RotatingPill } from "@/components/landing/RotatingPill";
import { eventStatus, fmtDate } from "@/lib/utils";
import { SKILLS } from "@/lib/constants";

type MyEvent = { id: string; name: string; code: string; starts_at: string; ends_at: string; status: string; city: string | null };

export default async function Home() {
  const { supabase, user } = await getUser();
  let events: MyEvent[] = [];
  if (user) {
    const { data } = await supabase
      .from("event_checkins")
      .select("checked_in_at, events(id,name,code,starts_at,ends_at,status,city)")
      .eq("user_id", user.id)
      .order("checked_in_at", { ascending: false })
      .limit(5);
    events = (data ?? []).map((r: { events: unknown }) => r.events as MyEvent).filter(Boolean);
  }

  return (
    <div className="-mt-4">
      <Hero signedIn={!!user} />
      {user ? <MyEvents events={events} /> : <Marketing />}
    </div>
  );
}

/** Hand-drawn squiggle used under highlighted words. */
function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 20" preserveAspectRatio="none" className={className}>
      <path d="M2 14 C 40 4, 70 18, 110 10 S 180 2, 220 12 S 280 16, 298 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function NameTag({ name, skill, className, color }: { name: string; skill: string; className: string; color: string }) {
  return (
    <div aria-hidden className={`absolute z-20 hidden w-40 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200 motion-safe:animate-float dark:bg-zinc-900 dark:ring-zinc-800 xl:block ${className}`}>
      <div className={`px-3 py-1.5 text-center ${color}`}>
        <p className="font-display text-sm font-extrabold uppercase leading-none">Hello</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest">my name is</p>
      </div>
      <div className="px-3 py-2 text-center">
        <p className="font-display text-xl font-bold italic">{name}</p>
        <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{skill}</p>
      </div>
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="full-bleed relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 text-zinc-300/70 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)] dark:text-zinc-700/60" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[780px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-400/30 via-fuchsia-300/20 to-lime-200/30 blur-3xl dark:from-violet-700/30 dark:via-fuchsia-700/15 dark:to-lime-500/10" />

      <NameTag name="Sara" skill="Designer · open to equity" color="bg-rose-400 text-white" className="bottom-28 left-[44%] [--r:-8deg]" />
      <NameTag name="Dev" skill="Backend · 10h/week" color="bg-sky-500 text-white" className="right-[5%] top-[24rem] [--r:7deg] [animation-delay:-2s]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_.9fr] lg:pb-24">
        <div className="text-center lg:text-left">
          <p className="mb-5 inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-900/80 dark:ring-zinc-800">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500" /></span>
            <RotatingPill />
          </p>
          <h1 className="animate-rise text-[2.6rem] font-extrabold leading-[1.02] [animation-delay:80ms] sm:text-6xl lg:text-7xl">
            Find your{" "}
            <span className="relative inline-block whitespace-nowrap text-brand dark:text-violet-400">
              co-founder
              <Squiggle className="absolute -bottom-2 left-0 h-3 w-full text-lime-400" />
            </span>{" "}
            before <RotatingSnack />
          </h1>
          <p className="mx-auto mt-6 max-w-xl animate-rise text-lg text-zinc-600 [animation-delay:160ms] dark:text-zinc-300 lg:mx-0">
            Stop pitching to the snack table. Post what you&apos;re building and let the <strong className="text-zinc-900 dark:text-white">right people</strong> come to you.
          </p>

          <div className="mt-8 animate-rise [animation-delay:240ms] lg:max-w-md">
            <TicketCode />
          </div>

          {!signedIn && (
            <div className="mt-6 flex animate-rise flex-wrap items-center justify-center gap-3 text-sm [animation-delay:320ms] lg:justify-start">
              <Link href="/login" className="font-semibold text-zinc-900 underline decoration-lime-400 decoration-[3px] underline-offset-4 hover:decoration-brand dark:text-white">
                Sign in to get ready
              </Link>
              <span className="text-zinc-400" aria-hidden>/</span>
              <Link href="/organizer/new" className="font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                Host an event →
              </Link>
            </div>
          )}
        </div>

        <div className="relative animate-rise [animation-delay:200ms]">
          <div aria-hidden className="absolute -right-2 -top-4 z-10 rotate-12 rounded-full bg-lime-300 px-3 py-1.5 font-display text-sm font-extrabold text-zinc-900 shadow-lg sm:right-6">
            real-time ✦
          </div>
          <LivePhone />
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const words = [...SKILLS.filter((s) => s !== "Other"), "Co-founder", "Weekend hacker", "Side project"];
  const row = [...words, ...words];
  return (
    <div aria-hidden className="full-bleed -rotate-2 overflow-hidden bg-brand py-4 text-white shadow-lg">
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap font-display text-2xl font-extrabold sm:text-3xl">
        {row.map((w, i) => (
          <span key={i} className="flex items-center gap-8">
            {w}
            <span className="text-lime-300">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const TIMELINE = [
  {
    time: "7:02 pm",
    title: "Scan in at the door",
    body: "Point your camera at the QR code. Sign in with GitHub, pick your skills, and you're on the board in under a minute.",
    visual: (
      <div className="flex flex-wrap gap-1.5">
        {["Frontend", "Design/UI/UX", "Growth"].map((s, i) => (
          <span key={s} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i < 2 ? "bg-brand text-white" : "bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"}`}>{s}</span>
        ))}
      </div>
    ),
  },
  {
    time: "7:05 pm",
    title: "Put your project up",
    body: "Say what you're building and who you need: a designer for equity, a backend dev for paid work, or anyone who wants in.",
    visual: (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800"><span className="font-semibold">Designer</span><span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-900">Equity</span></div>
        <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800"><span className="font-semibold">Backend</span><span className="rounded-full bg-emerald-200 px-2 py-0.5 font-semibold text-emerald-900">Paid</span></div>
      </div>
    ),
  },
  {
    time: "7:18 pm",
    title: "Count me in!",
    body: "Spot a project that needs your skills? Tap the button and add a quick note. The founder gets it in about a second.",
    visual: (
      <div className="flex gap-2">
        <span className="flex-1 rounded-xl bg-brand py-2.5 text-center text-xs font-bold text-white shadow-[0_4px_0_0_#4c1d95]">Count me in ✋</span>
      </div>
    ),
  },
  {
    time: "7:19 pm",
    title: "It's a match",
    body: "The founder taps Accept. You both see each other's contact details and get a shared space with chat, links and to-dos that lasts after tonight.",
    visual: (
      <div className="flex gap-2 text-xs font-bold">
        <span className="flex-1 rounded-xl bg-lime-300 py-2.5 text-center text-zinc-900">Accept</span>
        <span className="flex-1 rounded-xl bg-sky-100 py-2.5 text-center text-sky-900 dark:bg-sky-950 dark:text-sky-200">Let&apos;s talk</span>
        <span className="rounded-xl bg-zinc-100 px-3 py-2.5 text-center dark:bg-zinc-800">✕</span>
      </div>
    ),
  },
];

function Marketing() {
  return (
    <>
      <div className="py-10"><Marquee /></div>

      <section className="mx-auto max-w-3xl py-12">
        <p className="text-center font-mono text-xs font-bold uppercase tracking-[0.3em] text-brand dark:text-violet-400">How the night goes</p>
        <h2 className="mt-3 text-center text-4xl font-extrabold sm:text-5xl">From hello to co-founder in 17 minutes.</h2>
        <ol className="relative mt-12 space-y-6 before:absolute before:bottom-6 before:left-[1.15rem] before:top-6 before:w-0.5 before:bg-gradient-to-b before:from-brand before:to-lime-400 sm:before:left-[5.6rem]">
          {TIMELINE.map((s) => (
            <li key={s.time} className="relative grid grid-cols-[2.3rem_1fr] gap-4 sm:grid-cols-[4.5rem_2.3rem_1fr]">
              <span className="hidden pt-3 text-right font-mono text-xs font-bold text-zinc-600 dark:text-zinc-400 sm:block">{s.time}</span>
              <span className="relative z-10 mt-2 h-9 w-9 rounded-full border-4 border-zinc-50 bg-brand dark:border-zinc-950" aria-hidden />
              <div className="card p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-400 sm:hidden">{s.time}</span>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.body}</p>
                <div className="mt-4">{s.visual}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 py-8 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-amber-100 p-6 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
          <span aria-hidden className="absolute -right-4 -top-4 text-7xl opacity-80">🛠️</span>
          <p className="font-mono text-xs font-bold uppercase tracking-widest">For founders</p>
          <h3 className="mt-2 text-2xl font-extrabold">&ldquo;I need a designer, like, yesterday.&rdquo;</h3>
          <ul className="mt-4 space-y-2 text-sm font-medium">
            <li>✦ Post once and bring it to every event with one tap</li>
            <li>✦ Open specific roles, or open it up to anyone</li>
            <li>✦ Accept, decline, or meet first, right from your phone</li>
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-sky-100 p-6 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100">
          <span aria-hidden className="absolute -right-4 -top-4 text-7xl opacity-80">🙋</span>
          <p className="font-mono text-xs font-bold uppercase tracking-widest">For builders</p>
          <h3 className="mt-2 text-2xl font-extrabold">&ldquo;I want in on something cool.&rdquo;</h3>
          <ul className="mt-4 space-y-2 text-sm font-medium">
            <li>✦ The &ldquo;Needs my skills&rdquo; filter shows what fits you</li>
            <li>✦ Equity, paid, rev share, or just for fun</li>
            <li>✦ Your contact details stay private until you both say yes</li>
          </ul>
        </div>
      </section>

      <section className="full-bleed my-12 bg-zinc-950 text-white">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-lime-300">For organizers</p>
            <h2 className="mt-3 text-4xl font-extrabold sm:text-5xl">Put the whole room on the big screen.</h2>
            <p className="mt-4 text-zinc-300">
              Create an event in a minute and get a QR code to stick by the door. Throw the live board on the projector, and every match
              triggers a celebration everyone can see. When it&apos;s over, you get the recap.
            </p>
            <Link href="/organizer/new" className="mt-6 inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-lime-300 px-6 font-bold text-zinc-900 shadow-[0_5px_0_0_#3f6212] transition hover:-translate-y-0.5">
              Host an event <span aria-hidden>→</span>
            </Link>
          </div>
          <div aria-hidden className="relative rounded-3xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-display text-base font-bold text-white">Indie Hackers DXB</span>
              <span>42 here · 18 projects · 9 matches</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["BuildFast", "Pawsitive", "Quill.ai", "Tiny CRM"].map((n) => (
                <div key={n} className="rounded-xl bg-zinc-800 p-3"><p className="font-bold">{n}</p><div className="mt-2 h-1.5 w-2/3 rounded bg-zinc-700" /><div className="mt-1.5 h-1.5 w-1/2 rounded bg-zinc-700" /></div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rotate-[-4deg] rounded-2xl bg-brand px-5 py-4 text-center shadow-2xl ring-4 ring-lime-300/60 motion-safe:animate-float">
                <p className="text-3xl">🎉</p>
                <p className="font-display text-lg font-extrabold">Sara joined BuildFast</p>
                <p className="text-sm text-violet-200">as Designer</p>
              </div>
            </div>
            <div className="absolute -bottom-3 -right-3 grid h-16 w-16 grid-cols-4 gap-0.5 rounded-xl bg-white p-1.5">
              {Array.from({ length: 16 }).map((_, i) => <span key={i} className={[0, 2, 3, 5, 6, 9, 10, 12, 15].includes(i) ? "bg-zinc-900" : ""} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 py-4 sm:grid-cols-3">
        {[
          ["🔒", "Private by default", "Contact details only show up after an accepted match."],
          ["📶", "Built for venue Wi-Fi", "Small and fast, with instant feedback on every tap."],
          ["📲", "Installs like an app", "Add it to your home screen. No app store needed."],
        ].map(([icon, title, body]) => (
          <div key={title} className="card p-5">
            <span className="text-2xl" aria-hidden>{icon}</span>
            <h3 className="mt-2 font-bold">{title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
          </div>
        ))}
      </section>

      <section className="py-16 text-center">
        <h2 className="text-4xl font-extrabold sm:text-5xl">
          Less mingling.
          <br />
          <span className="relative inline-block text-brand dark:text-violet-400">More building.<Squiggle className="absolute -bottom-1 left-0 h-2.5 w-full text-lime-400" /></span>
        </h2>
        <Link href="/login" className="mt-8 inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-brand px-8 text-lg font-bold text-white shadow-[0_6px_0_0_#4c1d95] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_0_#4c1d95]">
          Count me in <span aria-hidden className="origin-bottom motion-safe:animate-wiggle">✋</span>
        </Link>
        <p className="mt-10 text-xs text-zinc-500 dark:text-zinc-500">Made for indie hackers, by indie hackers. © {new Date().getFullYear()} Countmein</p>
      </section>
    </>
  );
}

function MyEvents({ events }: { events: MyEvent[] }) {
  return (
    <section className="mx-auto max-w-md space-y-3 py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">Your events</h2>
        <Link href="/organizer/new" className="text-sm font-semibold text-brand dark:text-violet-400">Host one →</Link>
      </div>
      {events.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-3xl" aria-hidden>🎟️</p>
          <p className="mt-2 font-semibold">No events yet</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Enter a code above or scan the QR code at your next meetup.</p>
        </div>
      ) : (
        events.map((e) => {
          const st = eventStatus(e as never);
          return (
            <Link key={e.id} href={`/e/${e.code}`} className="card flex items-center justify-between p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div>
                <p className="font-semibold">{e.name}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{fmtDate(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</p>
              </div>
              <span className={`chip ${st === "live" ? "bg-red-500 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{st === "live" ? "● Live" : st}</span>
            </Link>
          );
        })
      )}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link href="/me/projects/new" className="card p-4 transition hover:-translate-y-0.5"><span aria-hidden className="text-xl">🚀</span><p className="mt-1 text-sm font-semibold">Post a project</p></Link>
        <Link href="/inbox" className="card p-4 transition hover:-translate-y-0.5"><span aria-hidden className="text-xl">📬</span><p className="mt-1 text-sm font-semibold">Check your inbox</p></Link>
      </div>
    </section>
  );
}
