import { Resend } from "resend";

/** Sends an email via Resend. No-op (returns false) when RESEND_API_KEY is not configured. */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Countmein <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    return !error;
  } catch {
    return false;
  }
}

export function emailLayout(title: string, body: string, ctaHref?: string, ctaLabel?: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;color:#18181b">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <div style="font-size:15px;line-height:1.5">${body}</div>
  ${ctaHref ? `<p style="margin-top:20px"><a href="${ctaHref}" style="background:#6d28d9;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">${ctaLabel ?? "Open Countmein"}</a></p>` : ""}
  <p style="color:#71717a;font-size:12px;margin-top:24px">Countmein: find collaborators at indie hacker meetups</p>
</div>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
