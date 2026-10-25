"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Field, FormSection } from "@/components/ui/Form";
import { timeAgo } from "@/lib/utils";
import type { EventMessage, EventRow } from "@/lib/types";
import type { Guest } from "./core";
import { HIcon } from "./ui";

type Audience = EventMessage["audience"];

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "all", label: "Everyone registered" },
  { value: "going", label: "Going" },
  { value: "checked_in", label: "Checked in" },
  { value: "pending", label: "Pending approval" },
  { value: "waitlist", label: "Waitlist" },
];

function audienceCount(guests: Guest[], a: Audience) {
  return guests.filter((g) => {
    if (a === "all") return ["going", "pending", "waitlist"].includes(g.status) || !!g.checked_in_at;
    if (a === "checked_in") return !!g.checked_in_at;
    if (a === "going") return g.status === "going";
    return g.status === a;
  }).length;
}

export function MessagesPanel({ event, userId, guests, initial }: { event: EventRow; userId: string; guests: Guest[]; initial: EventMessage[] }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [messages, setMessages] = useState(initial);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [sending, setSending] = useState(false);
  const [emailOff, setEmailOff] = useState(false);
  const recipients = audienceCount(guests, audience);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    if (!confirm(`Send "${subject.trim()}" to ${recipients} ${recipients === 1 ? "person" : "people"}?`)) return;
    setSending(true);
    let posted: EventMessage | null = null;
    let emailed = 0;
    let configured = true;
    try {
      const res = await fetch(`/api/events/${event.id}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), audience }),
      });
      if (res.status === 404 || res.status === 405 || res.status === 501) throw new Error("route-missing");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSending(false); return toast(data.error || "Couldn't send the message", { kind: "error" }); }
      emailed = data.emailed ?? 0;
      configured = data.configured !== false;
      posted = { id: data.id ?? crypto.randomUUID(), event_id: event.id, author_id: userId, subject: subject.trim(), body: body.trim(), audience, emailed_count: emailed, created_at: new Date().toISOString() };
    } catch {
      // No send route yet: post it to the event page directly (RLS allows hosts).
      const { data, error } = await supabase.from("event_messages")
        .insert({ event_id: event.id, author_id: userId, subject: subject.trim(), body: body.trim(), audience })
        .select().single();
      if (error) { setSending(false); return toast(error.message, { kind: "error" }); }
      posted = data as EventMessage;
      configured = false;
    }
    setSending(false);
    setMessages((m) => [posted!, ...m]);
    setSubject(""); setBody("");
    setEmailOff(!configured);
    toast(configured ? `Sent to ${emailed} ${emailed === 1 ? "inbox" : "inboxes"} and posted on the event page` : "Posted on the event page. Email isn't set up yet.", { kind: "success" });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this message from the event page? Emails already sent can't be unsent.")) return;
    const { error } = await supabase.from("event_messages").delete().eq("id", id);
    if (error) return toast(error.message, { kind: "error" });
    setMessages((m) => m.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-5">
      <FormSection title="Message your guests" description="Doors moved? Pizza arrived? Guests see updates on the event page, and by email when it's set up.">
        <form onSubmit={send} className="space-y-4">
          <Field label="Send to" htmlFor="msg-aud" hint={`${recipients} ${recipients === 1 ? "person" : "people"} will get this.`}>
            <select id="msg-aud" className="input" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
              {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label} ({audienceCount(guests, a.value)})</option>)}
            </select>
          </Field>
          <Field label="Subject" htmlFor="msg-sub" required counter={{ value: subject.length, max: 140 }}>
            <input id="msg-sub" className="input" maxLength={140} placeholder="Doors open at 7, we're on level 3" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message" htmlFor="msg-body" required counter={{ value: body.length, max: 4000 }}>
            <textarea id="msg-body" className="input" rows={5} maxLength={4000} placeholder="Take the lift by the cafe. Bring your laptop, demos start at 8." value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {emailOff && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Email isn&apos;t set up yet, so this went to the event page only. Guests see it under &ldquo;Updates from the host&rdquo;.
            </p>
          )}
          <button className="btn-primary w-full sm:w-auto" disabled={sending || !subject.trim() || !body.trim() || recipients === 0}>
            <HIcon name="send" className="h-4 w-4" /> {sending ? "Sending…" : recipients === 0 ? "No one to send to yet" : `Send to ${recipients}`}
          </button>
        </form>
      </FormSection>

      <section aria-label="Sent messages">
        <h3 className="mb-3 text-lg font-extrabold">Sent <span className="text-zinc-400">· {messages.length}</span></h3>
        {messages.length === 0 ? (
          <p className="rounded-3xl bg-zinc-50 p-6 text-center text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-400 dark:ring-zinc-800">
            Nothing sent yet. A quick &ldquo;see you tonight&rdquo; the day before works wonders for turnout.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {messages.map((m) => (
              <li key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{m.subject}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {AUDIENCES.find((a) => a.value === m.audience)?.label} · {timeAgo(m.created_at)}
                      {m.emailed_count > 0 ? ` · emailed ${m.emailed_count}` : " · event page only"}
                    </p>
                  </div>
                  <button className="btn-ghost btn-sm shrink-0 text-red-600" onClick={() => remove(m.id)} aria-label={`Delete ${m.subject}`}>Delete</button>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
