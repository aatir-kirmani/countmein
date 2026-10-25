import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund Policy · Countmein",
  description: "How refunds work for any paid features on Countmein.",
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: "free",
    title: "Countmein is free right now",
    body: (
      <p>
        Everything on Countmein is currently free, so there is nothing to refund. This policy explains how refunds will work if we introduce paid plans or features, so you know where you stand before you ever pay.
      </p>
    ),
  },
  {
    id: "creem",
    title: "Who handles payments",
    body: (
      <p>
        Paid purchases will be processed by <strong>Creem</strong>, our online reseller and Merchant of Record. Creem appears on your receipt and bank statement, handles taxes, and issues refunds to your original payment method.
      </p>
    ),
  },
  {
    id: "window",
    title: "14-day refund window",
    body: (
      <>
        <ul>
          <li>You can request a full refund within <strong>14 days</strong> of your first purchase of any paid plan or feature, for any reason.</li>
          <li>For subscriptions, you can cancel at any time. Cancelling stops future renewals and you keep access until the end of the period you paid for. Renewals can be refunded if you ask within 14 days of the renewal date and have not used the paid features since.</li>
          <li>If you were charged by mistake, charged twice, or a paid feature did not work as described, we will refund you regardless of timing.</li>
        </ul>
      </>
    ),
  },
  {
    id: "how",
    title: "How to request a refund",
    body: (
      <>
        <ul>
          <li>Email {mail} from the address you used to pay, with your order number from the Creem receipt. You do not need to give a reason.</li>
          <li>You can also contact Creem directly using the link on your receipt.</li>
        </ul>
        <p>Approved refunds are sent within 5 business days. Depending on your bank, it can take another 5 to 10 business days to appear on your statement.</p>
      </>
    ),
  },
  {
    id: "exceptions",
    title: "When we may decline",
    body: (
      <p>
        We may decline refund requests that fall outside the windows above, or that show clear abuse, such as repeated buy-and-refund cycles. Where local consumer law gives you more rights than this policy, those rights always apply.
      </p>
    ),
  },
  {
    id: "related",
    title: "Related policies",
    body: (
      <p>
        See our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>. Questions about a charge? Email {mail}.
      </p>
    ),
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      current="/refunds"
      eyebrow="Money back"
      title="Refund Policy"
      intro={<p>Short and fair: if you ever pay for something on Countmein and it is not right for you, ask within 14 days and you get your money back.</p>}
      sections={sections}
    />
  );
}
