import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy · Countmein",
  description: "What Countmein collects, why, who can see it, and how to delete it.",
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
      {rows.map(([a, b], i) => (
        <div key={a} className={`grid gap-1 p-4 sm:grid-cols-[180px_1fr] sm:gap-4 ${i % 2 ? "bg-zinc-50 dark:bg-zinc-900/60" : "bg-white dark:bg-zinc-900"}`}>
          <p className="font-semibold text-zinc-900 dark:text-white">{a}</p>
          <p className="text-sm">{b}</p>
        </div>
      ))}
    </div>
  );
}

const sections: LegalSection[] = [
  {
    id: "summary",
    title: "The short version",
    body: (
      <ul>
        <li>We collect what you give us to run the app: your profile, projects, requests and messages.</li>
        <li><strong>Your email and phone number are private.</strong> They are only shown to someone after you both agree to work together on a project.</li>
        <li>We do not sell your data, and we do not use advertising or third-party tracking cookies.</li>
        <li>You can delete your account and data yourself, at any time, from your profile page.</li>
      </ul>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <Table
          rows={[
            ["Account", "Your email address, and if you sign in with GitHub or Google, your name, username and profile picture from that account."],
            ["Profile", "Name, username, photo, bio, skills, links (X, LinkedIn, GitHub, website, portfolio), hours per week and what you are looking for."],
            ["Private contact", "Your contact email and, if you add it, your phone number."],
            ["Events", "Events you register for and check in to, your registration status, answers to any questions the host asks, and any location note you add (for example \"table 4, blue shirt\")."],
            ["Projects and requests", "Projects you post, open roles, join requests and invites you send or receive, and their status."],
            ["Project spaces", "Messages, tasks, shared links and notes inside projects you are a member of."],
            ["Uploads", "Photos and videos you add to your profile, projects or events."],
            ["Safety", "Reports you file and people you block."],
            ["Technical", "When you were last active (to decide whether to email you about a request), and standard server logs such as IP address, browser type and errors, kept by our hosting providers for security."],
            ["Payments", "Countmein is free right now. If paid features are introduced, our payment provider Creem will collect your payment details. We would only receive a confirmation, the amount, and your email, never your full card number."],
          ]}
        />
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run the service: sign you in, show your profile and projects, deliver requests and messages, and power the live event board.</li>
        <li>To match people: for example the &ldquo;Needs my skills&rdquo; filter compares your skills with open roles.</li>
        <li>To send you emails you would expect: sign-in links, new requests or invites when you are offline, updates about your registration, reminders before events you are going to, messages from the hosts of events you registered for, and event recaps.</li>
        <li>To keep Countmein safe: review reports, prevent spam and abuse, and enforce our <Link href="/terms">Terms</Link>.</li>
        <li>To fix bugs and improve the product.</li>
      </ul>
    ),
  },
  {
    id: "legal-bases",
    title: "Why we are allowed to",
    body: (
      <>
        <p>Where privacy laws such as the GDPR or UAE PDPL apply, we rely on:</p>
        <ul>
          <li><strong>Contract:</strong> processing needed to provide the service you signed up for.</li>
          <li><strong>Legitimate interests:</strong> keeping the service secure, preventing abuse and improving it, balanced against your rights.</li>
          <li><strong>Consent:</strong> for optional things such as adding a phone number. You can withdraw consent by removing the information.</li>
          <li><strong>Legal obligation:</strong> where the law requires us to keep or share information.</li>
        </ul>
      </>
    ),
  },
  {
    id: "visibility",
    title: "Who can see what",
    body: (
      <Table
        rows={[
          ["Anyone", "Your public profile (name, username, photo, bio, skills, links, availability) and your projects. Never your email or phone."],
          ["People at an event", "For public events, anyone can see the board. For unlisted and invite-only events, only checked-in attendees and the organizer see who is there and which projects are shown."],
          ["Event hosts", "For events you register for or check in to: your profile, registration status and answers, check-in time and location note. Hosts and co-hosts can export this to run the event and can send you event updates."],
          ["Project founders", "The requests you send to their project, including your message and profile."],
          ["Your collaborators", "Your contact email and phone, only after a request or invite between you is accepted. Members of a project space see its messages, tasks and links."],
          ["Blocked users", "People you block cannot see your profile or projects, or send you requests."],
        ]}
      />
    ),
  },
  {
    id: "sharing",
    title: "Service providers we use",
    body: (
      <>
        <p>We share data only with providers that help us run Countmein, under agreements that require them to protect it:</p>
        <ul>
          <li><strong>Supabase</strong>: database, sign-in and file storage. Your data is stored in Supabase&apos;s Tokyo (Japan) region.</li>
          <li><strong>Vercel</strong>: hosts the website and runs our servers.</li>
          <li><strong>GitHub and Google</strong>: only if you choose to sign in with them.</li>
          <li><strong>Resend</strong>: sends notification and recap emails, if enabled.</li>
          <li><strong>Creem</strong>: our Merchant of Record for any future paid features, handling checkout, payments and tax. Creem processes payment data under its own privacy policy.</li>
        </ul>
        <p>We do not sell or rent your personal data. We may disclose information if required by law, to protect someone&apos;s safety, or as part of a merger or sale of the service, in which case this policy would continue to apply.</p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Our providers may process data outside the country you live in, including in Japan, the United States and the European Union. Where required, we rely on appropriate safeguards such as standard contractual clauses offered by those providers.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <>
        <p>We only use what is needed for the app to work:</p>
        <ul>
          <li>Sign-in cookies that keep you logged in.</li>
          <li>Your light or dark mode preference, saved in your browser.</li>
          <li>An offline cache of public pages (home, event and project pages) so the app loads on weak venue Wi-Fi. Private pages such as your inbox and project spaces are never cached.</li>
        </ul>
        <p>We do not use advertising, analytics or cross-site tracking cookies.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Your account data is kept until you delete your account.</li>
        <li>When you delete your account, your profile, projects, requests, check-ins, messages and uploaded files are deleted straight away. Backups held by our providers roll off within about 30 days.</li>
        <li>Event boards become read-only when an event ends and are hidden 7 days later. Pending requests expire 48 hours after an event ends.</li>
        <li>Reports are kept only as long as we need them to review and act on them.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights and choices",
    body: (
      <>
        <p>Depending on where you live, you may have the right to access, correct, delete, export or restrict the use of your personal data, and to object to some processing. You can:</p>
        <ul>
          <li>Edit your profile and contact details at any time on your profile page.</li>
          <li>Delete your account yourself from your profile page (Me, then Delete account).</li>
          <li>Email {mail} for a copy of your data or any other request. We will respond within 30 days.</li>
        </ul>
        <p>You also have the right to complain to your local data protection authority.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data is encrypted in transit and at rest by our providers. Access is controlled by database security rules that we test, so that, for example, contact details cannot be read by anyone without an accepted connection.
        No system is perfectly secure, so please use a strong password on your email and GitHub or Google accounts, and tell us right away if you notice anything suspicious.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Countmein is not meant for anyone under 16. If you believe a child has created an account, contact us and we will remove it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>If we make significant changes, we will update the date above and let you know in the app or by email before they take effect.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>For privacy questions or requests, email {mail}.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      eyebrow="Your data"
      title="Privacy Policy"
      intro={<p>We built Countmein so you can meet people in the room without giving your number to the whole room. Here is exactly what we collect and who can see it.</p>}
      sections={sections}
    />
  );
}
