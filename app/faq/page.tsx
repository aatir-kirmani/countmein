import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ · Countmein",
  description: "Answers about Countmein: pricing, privacy, events, organizers, payments, refunds and your account.",
};

type QA = { q: string; a: React.ReactNode; text: string };
type Group = { id: string; title: string; icon: string; items: QA[] };

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const GROUPS: Group[] = [
  {
    id: "basics",
    title: "The basics",
    icon: "👋",
    items: [
      {
        q: "What is Countmein?",
        text: "Countmein is a live board for indie hacker meetups. You check in to an event, show what you are building, and tap Count me in on projects that need your skills. Founders accept on the spot and you both get each other's contact details and a shared project space.",
        a: <p>A live board for indie hacker meetups. You check in to an event, show what you are building, and tap <strong>Count me in</strong> on projects that need your skills. Founders accept on the spot, and you both get each other&apos;s contact details and a shared project space that lasts after the event.</p>,
      },
      {
        q: "Is it free?",
        text: "Yes. Everything on Countmein is free right now for attendees, founders and organizers. If we add paid features later, prices will be shown clearly before you pay, and free features will not start charging without notice.",
        a: <p>Yes. Everything is free right now, for attendees, founders and organizers. If we ever add paid features, prices will be shown clearly before you pay, and nothing that is free today will start charging you without notice.</p>,
      },
      {
        q: "Do I need to download an app?",
        text: "No. Countmein runs in your phone's browser. You can add it to your home screen from the browser menu so it opens like an app.",
        a: <p>No. It runs in your phone&apos;s browser. For an app-like experience, use &ldquo;Add to Home Screen&rdquo; from your browser menu.</p>,
      },
      {
        q: "How do I join an event?",
        text: "Scan the QR code at the venue with the Scan button or your phone camera, or type the 6-character event code on the home page. Sign in, pick your skills and check in.",
        a: <p>Scan the QR code at the venue (use the <Link href="/scan">Scan</Link> button or your camera), or type the 6-character event code on the <Link href="/">home page</Link>. Sign in, pick your skills, and check in. It takes under a minute.</p>,
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and safety",
    icon: "🔒",
    items: [
      {
        q: "Who can see my email and phone number?",
        text: "Nobody, until a founder accepts your request or you accept their invite. Only then do the two of you see each other's contact details. They are never shown on your public profile.",
        a: <p>Nobody, until you match. Your contact details are only revealed to someone after a request or invite between you is accepted. They are never on your public profile.</p>,
      },
      {
        q: "What is public on my profile?",
        text: "Your name, username, photo, bio, skills, links, availability and projects. You can edit any of it on your profile page.",
        a: <p>Your name, username, photo, bio, skills, links, availability and projects. You can edit all of it on your <Link href="/me">profile page</Link>.</p>,
      },
      {
        q: "Someone is bothering me. What can I do?",
        text: "Block them from their profile so they cannot see your projects or contact you, and use the Report button on their profile, project or message. We review every report.",
        a: <p><strong>Block</strong> them from their profile so they can&apos;t see your projects or send you requests, and use <strong>Report</strong> on their profile, project or message. We review every report. If you feel unsafe at an event, tell the organizer or venue staff right away.</p>,
      },
      {
        q: "Do you sell my data or show ads?",
        text: "No. We do not sell personal data and we do not use advertising or tracking cookies.",
        a: <p>No. We don&apos;t sell personal data and we don&apos;t use advertising or tracking cookies. Details are in our <Link href="/privacy">Privacy Policy</Link>.</p>,
      },
    ],
  },
  {
    id: "founders",
    title: "Founders and collaborators",
    icon: "🛠️",
    items: [
      {
        q: "How do I find people for my project?",
        text: "Post your project once, add open roles such as Designer or Backend with commitment and compensation, and bring it to any event you check in to with one tap. Requests arrive in real time and you can accept, decline or ask to talk first.",
        a: <p>Post your project once with open roles (for example Designer for equity, Backend paid), then bring it to any event you check in to with one tap. Requests arrive in real time: accept, decline, or tap &ldquo;Let&apos;s talk&rdquo; to meet first. From the People tab you can also invite someone directly.</p>,
      },
      {
        q: "Does Countmein handle equity or contracts?",
        text: "No. Any agreement about equity, payment or ownership is between you and your collaborators. We recommend putting it in writing.",
        a: <p>No. Any deal about equity, pay or ownership is between you and your collaborators, and we&apos;re not a party to it. We recommend putting important agreements in writing. See our <Link href="/terms#collaborations">Terms</Link>.</p>,
      },
      {
        q: "How many requests can I send?",
        text: "Up to 10 requests per event, and one open request per project, so founders get thoughtful requests instead of spam.",
        a: <p>Up to 10 per event, and one open request per project. It keeps requests thoughtful and founders&apos; inboxes sane.</p>,
      },
    ],
  },
  {
    id: "organizers",
    title: "Organizers",
    icon: "🎤",
    items: [
      {
        q: "How do I host an event?",
        text: "Tap Host, fill in the event details and add at least one photo. You get a 6-character code, a QR code, a printable door poster and a live board to put on the projector.",
        a: <p>Tap <Link href="/organizer">Host</Link>, fill in the details and add at least one photo. You get a 6-character code, a QR code, a printable door poster and a live board for the projector, plus attendee stats and a CSV export.</p>,
      },
      {
        q: "Can I make an event private?",
        text: "Yes. Unlisted events are only reachable with the code or QR. Invite-only events only let in the email addresses you add.",
        a: <p>Yes. <strong>Unlisted</strong> events can only be reached with the code or QR. <strong>Invite only</strong> events let in only the emails you add on the manage page.</p>,
      },
      {
        q: "Can I sell tickets?",
        text: "Not yet. All events are free for now. Paid features will be processed by our Merchant of Record, Creem, when they launch.",
        a: <p>Not yet. All events are free for now. When paid features launch, payments will be processed by our Merchant of Record, Creem.</p>,
      },
    ],
  },
  {
    id: "payments",
    title: "Payments and refunds",
    icon: "💳",
    items: [
      {
        q: "Who processes payments?",
        text: "Creem, our online reseller and Merchant of Record, will process any future payments. Creem handles checkout, card security, receipts and sales tax or VAT. Countmein never sees your full card details.",
        a: <p><strong>Creem</strong>, our online reseller and Merchant of Record, will process any future payments. Creem handles checkout, card security, receipts and sales tax or VAT, and will appear on your statement. We never see your full card details.</p>,
      },
      {
        q: "What is your refund policy?",
        text: "If you pay for anything on Countmein, you can get a full refund within 14 days of your first purchase, for any reason. Mistaken or double charges are always refunded.",
        a: <p>Full refund within 14 days of your first purchase, for any reason, and mistaken or double charges are always refunded. Read the full <Link href="/refunds">Refund Policy</Link>.</p>,
      },
      {
        q: "Which currencies and taxes apply?",
        text: "Prices will be shown in US dollars. Any sales tax or VAT is calculated by Creem at checkout based on your location before you confirm.",
        a: <p>Prices will be shown in US dollars. Any sales tax or VAT is calculated by Creem at checkout, based on your location, before you confirm.</p>,
      },
    ],
  },
  {
    id: "account",
    title: "Your account",
    icon: "🙋",
    items: [
      {
        q: "How do I sign in?",
        text: "With GitHub, or with a magic link sent to your email. No password needed.",
        a: <p>With GitHub, or with a magic link sent to your email. No password to remember.</p>,
      },
      {
        q: "How do I delete my account?",
        text: "Go to Me, scroll to the bottom and tap Delete account. Your profile, projects, requests, messages and uploads are deleted immediately.",
        a: <p>Go to <Link href="/me">Me</Link>, scroll to the bottom and tap <strong>Delete account</strong>. Your profile, projects, requests, messages and uploads are deleted immediately.</p>,
      },
      {
        q: "How do I contact you?",
        text: `Email ${SUPPORT_EMAIL}. A human replies, usually within two business days.`,
        a: <p>Email {mail}. A human replies, usually within two business days.</p>,
      },
    ],
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((g) => g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.text } }))),
  };

  return (
    <div className="pb-8 pt-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="mb-8">
        <p className="eyebrow">Good questions</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">Frequently asked questions</h1>
        <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300">Everything you might wonder before your next meetup. Can&apos;t find it? Email {mail}.</p>
        <nav aria-label="FAQ topics" className="mt-6 flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset ring-zinc-200 transition hover:ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-700">
              <span aria-hidden className="mr-1">{g.icon}</span>{g.title}
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-10">
        {GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-20">
            <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold">
              <span aria-hidden>{g.icon}</span>{g.title}
            </h2>
            <div className="space-y-2.5">
              {g.items.map((i) => (
                <details key={i.q} className="group card overflow-hidden open:ring-2 open:ring-brand dark:open:ring-violet-400">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-bold [&::-webkit-details-marker]:hidden">
                    {i.q}
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg transition group-open:rotate-45 group-open:bg-brand group-open:text-white dark:bg-zinc-800">+</span>
                  </summary>
                  <div className="legal-prose px-5 pb-5 -mt-1">{i.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="mt-12 rounded-3xl bg-brand p-6 text-white shadow-[0_6px_0_0_#4c1d95]">
        <p className="font-display text-2xl font-extrabold">Still curious?</p>
        <p className="mt-1 text-violet-100">Read the <Link href="/terms" className="font-semibold underline underline-offset-2">Terms</Link>, <Link href="/privacy" className="font-semibold underline underline-offset-2">Privacy Policy</Link> and <Link href="/refunds" className="font-semibold underline underline-offset-2">Refund Policy</Link>, or just ask.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-accent mt-4">Email {SUPPORT_EMAIL}</a>
      </aside>
    </div>
  );
}
