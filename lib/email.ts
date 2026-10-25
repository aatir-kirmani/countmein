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

/** Branded email shell: Countmein wordmark, title, body, optional primary button and footer note. */
export function emailLayout(title: string, body: string, ctaHref?: string, ctaLabel?: string, footer?: string) {
  return `<div style="background:#f4f4f5;padding:24px 12px">
<div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;max-width:540px;margin:auto;background:#ffffff;border-radius:20px;padding:28px 24px;color:#18181b;border:1px solid #e4e4e7">
  <p style="font-size:18px;font-weight:800;margin:0 0 20px;letter-spacing:-0.01em">Count<span style="color:#6d28d9">me</span>in<span style="color:#84cc16"> &#10022;</span></p>
  <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;letter-spacing:-0.01em">${title}</h1>
  <div style="font-size:15px;line-height:1.6;color:#3f3f46">${body}</div>
  ${ctaHref ? `<p style="margin:24px 0 0"><a href="${ctaHref}" style="display:inline-block;background:#6d28d9;color:#ffffff;padding:13px 20px;border-radius:14px;text-decoration:none;font-weight:700;border-bottom:3px solid #4c1d95">${ctaLabel ?? "Open Countmein"}</a></p>` : ""}
  <p style="color:#a1a1aa;font-size:12px;line-height:1.5;margin:28px 0 0">${footer ?? "You are getting this because of activity on your Countmein account."}</p>
</div></div>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
