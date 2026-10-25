import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service · Countmein",
  description: "The rules for using Countmein, the live board for indie hacker meetups.",
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: "about",
    title: "What Countmein is",
    body: (
      <>
        <p>
          Countmein (&ldquo;Countmein&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a web app that helps people at in-person meetups find collaborators.
          Attendees check in to an event, share what they are building, and request to join each other&apos;s projects. Organizers create events and display a live board at the venue.
        </p>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you and Countmein. By creating an account or using the app, you agree to them.
          If you do not agree, please do not use Countmein.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use it",
    body: (
      <ul>
        <li>You must be at least 16 years old, and old enough to enter into a binding agreement where you live.</li>
        <li>You must give accurate information when you sign up and keep it up to date.</li>
        <li>One person, one account. You are responsible for everything that happens under your account, so keep your sign-in methods secure.</li>
        <li>If we have previously suspended your account, you may not create a new one without our permission.</li>
      </ul>
    ),
  },
  {
    id: "pricing",
    title: "Pricing and payments",
    body: (
      <>
        <p>
          <strong>Countmein is currently free for everyone.</strong> Creating an account, checking in to events, posting projects, sending requests, using project spaces and hosting events do not cost anything.
        </p>
        <p>We may introduce paid plans or paid features in the future. If we do:</p>
        <ul>
          <li>The price, currency, billing period (if any) and what you get will be shown clearly before you pay. Nothing will be charged without your explicit confirmation.</li>
          <li>
            Payments will be processed by our online reseller and Merchant of Record, <strong>Creem</strong>, which handles checkout, billing, payment security, and sales tax or VAT.
            Your purchase will also be subject to Creem&apos;s terms, which are shown at checkout. Countmein never sees or stores your full card details.
          </li>
          <li>Taxes are calculated at checkout based on your location and are included in or added to the price as shown.</li>
          <li>Refunds follow our <Link href="/refunds">Refund Policy</Link>.</li>
          <li>Features that are free today will not start charging you without notice. We will tell you in advance and you can choose not to pay.</li>
        </ul>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          &ldquo;Your content&rdquo; means anything you add to Countmein: your profile, projects, role descriptions, requests, messages, tasks, links, photos and videos.
          You keep ownership of it.
        </p>
        <p>
          To run the service, you give us a worldwide, non-exclusive, royalty-free licence to host, store, copy, display and share your content, only as needed to operate and improve Countmein and to show it to the people you share it with
          (for example other attendees of an event, or members of a project space). This licence ends when you delete the content or your account, except for copies other users already received, such as messages you sent them.
        </p>
        <p>You promise that you have the rights to everything you post, and that it does not break these Terms or any law.</p>
        <p>
          Photos and videos you upload to events or projects are stored at public web addresses so they can be displayed quickly. Do not upload anything you would not want to be public.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Countmein works because people trust the room. You agree not to:</p>
        <ul>
          <li>Harass, threaten, discriminate against, stalk or intimidate anyone, online or at an event.</li>
          <li>Post content that is illegal, sexually explicit, hateful, violent, deceptive or that infringes someone else&apos;s rights.</li>
          <li>Impersonate another person or misrepresent your project, skills or affiliation.</li>
          <li>Spam people with requests, invites or messages, or use Countmein for unsolicited advertising.</li>
          <li>Collect other users&apos; data, including contact details, for any purpose other than the collaboration you both agreed to.</li>
          <li>Scrape, reverse engineer, overload, or try to break or bypass the security of the service.</li>
          <li>Use Countmein to promote scams, multi-level marketing, gambling, adult services or anything prohibited by our payment provider.</li>
        </ul>
        <p>You can report a profile, project or message from inside the app. We review reports and may remove content or suspend accounts.</p>
      </>
    ),
  },
  {
    id: "events",
    title: "Events and organizers",
    body: (
      <>
        <p>
          Events on Countmein are created and run by independent organizers, not by Countmein. The organizer is responsible for the venue, the schedule, safety, the guest list and how the event is run.
        </p>
        <p>If you organize an event, you agree to:</p>
        <ul>
          <li>Describe your event accurately and keep its details up to date.</li>
          <li>Only invite or display people in ways that respect their privacy, including on the projector board.</li>
          <li>Use attendee information you can access (for example the attendee export) only to run that event and its follow-up, and handle it in line with applicable privacy laws.</li>
          <li>Follow the laws and venue rules that apply to your event.</li>
        </ul>
        <p>Please use common sense when meeting people in person. Countmein does not screen attendees and is not responsible for what happens at an event.</p>
      </>
    ),
  },
  {
    id: "collaborations",
    title: "Collaborations between users",
    body: (
      <>
        <p>
          When a founder accepts your request, Countmein shares your contact details with each other and opens a shared project space. That is where our role ends.
        </p>
        <p>
          Any agreement you make with another user, such as equity, payment, revenue share, intellectual property or employment, is solely between you and them. Countmein is not a party to it,
          does not verify anyone&apos;s claims, and is not responsible for whether either side keeps its promises. We recommend putting important agreements in writing.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and deleting your account",
    body: (
      <>
        <p>You can delete your account at any time from your profile page (Me, then Delete account). This removes your profile, projects, requests, messages and uploads.</p>
        <p>
          We may suspend or close an account, or remove content, if it breaks these Terms, puts other users at risk, or if we are required to by law. Where it is reasonable, we will tell you why.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "Changes to the service",
    body: (
      <p>
        We are a small team and Countmein is evolving quickly. We may add, change or remove features at any time. We will try to give notice of changes that significantly affect you,
        and we will never remove access to your own content without giving you a chance to save it, unless the law or user safety requires it.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        Countmein is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make no promises that the service will be uninterrupted, error free or suitable for a particular purpose,
        and we do not guarantee that you will find collaborators or that any collaboration will succeed. Information posted by users is theirs, not ours, and we do not verify it.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the extent the law allows, Countmein will not be liable for indirect, incidental, special or consequential losses, or for lost profits, data or opportunities, arising from your use of the service,
        from events, or from dealings with other users. Our total liability for any claim relating to Countmein is limited to the greater of the amount you paid us in the 12 months before the claim, or USD 50.
        Nothing in these Terms limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: (
      <p>
        We may update these Terms from time to time. When we do, we will change the date at the top of this page, and for significant changes we will let you know in the app or by email before they take effect.
        If you keep using Countmein after changes take effect, you accept the updated Terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions, complaints or legal notices: {mail}. We aim to reply within two business days.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      eyebrow="The fine print"
      title="Terms of Service"
      intro={<p>Plain-English rules for using Countmein. The short version: be kind, post honestly, and remember that deals you make with collaborators are between you and them.</p>}
      sections={sections}
    />
  );
}
