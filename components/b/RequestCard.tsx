"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import type { JoinRequest, Profile } from "@/lib/types";
import { DECLINE_REASONS, LINK_FIELDS } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badges";
import { notify } from "./notify";
import { Icon } from "./ui";

export type FullRequest = JoinRequest & {
  requester: Pick<Profile, "id" | "name" | "username" | "avatar_url" | "bio" | "skills" | "links"> | null;
  project: { id: string; name: string; owner_id: string; owner?: Pick<Profile, "id" | "name" | "username" | "avatar_url"> | null } | null;
  slot: { specialty: string; status?: string } | null;
};

export const REQUEST_SELECT =
  "*, requester:profiles!join_requests_requester_id_fkey(id,name,username,avatar_url,bio,skills,links), project:projects(id,name,owner_id,owner:profiles!projects_owner_id_fkey(id,name,username,avatar_url)), slot:project_slots(specialty,status)";

/** One request/invite with the actions the viewer is allowed to take. */
export function RequestCard({ r, viewerId, onChanged }: { r: FullRequest; viewerId: string; onChanged: (id: string, status: JoinRequest["status"]) => void }) {
  const supabase = createClient();
  const { toast, refreshPending } = useApp();
  const isOwner = r.project?.owner_id === viewerId;
  const isCand = r.requester_id === viewerId;
  const open = r.status === "pending" || r.status === "interested";
  const canRespond = open && ((r.direction === "request" && isOwner) || (r.direction === "invite" && isCand && r.status === "pending"));
  const canWithdraw = open && ((r.direction === "request" && isCand) || (r.direction === "invite" && isOwner));
  const [fill, setFill] = useState(true);
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState<{ contact_email: string | null; contact_phone: string | null } | null>(null);
  const [meetNote, setMeetNote] = useState<string | null>(null);

  // The "other person" from the viewer's perspective.
  const other = isOwner ? r.requester : r.project?.owner ?? null;

  // Wait until any in-flight action settles: an optimistic "accepted" would otherwise fetch before the RPC commits.
  useEffect(() => {
    if (busy) return;
    if (r.status === "accepted" && other) {
      supabase.rpc("get_contact", { p_user: other.id }).then(({ data }: { data: { contact_email: string | null; contact_phone: string | null }[] | null }) => setContact(data?.[0] ?? null));
    }
    if (r.status === "interested" && isCand) {
      supabase.rpc("get_meetup_note", { p_request: r.id }).then(({ data }: { data: string | null }) => setMeetNote(data));
    }
  }, [supabase, r.status, r.id, other, isCand, busy]);

  const act = async (action: "accept" | "decline" | "interested" | "withdraw", reason?: string) => {
    setBusy(true);
    const prev = r.status;
    const next = ({ accept: "accepted", decline: "declined", interested: "interested", withdraw: "withdrawn" } as const)[action];
    onChanged(r.id, next); // optimistic
    const { error } = await supabase.rpc("respond_join_request", { p_id: r.id, p_action: action, p_reason: reason ?? null, p_fill_slot: action === "accept" && fill });
    setBusy(false);
    setDeclining(false);
    if (error) { onChanged(r.id, prev); return toast(error.message, { kind: "error" }); }
    if (action !== "withdraw") notify(r.id);
    if (action === "accept") toast("🎉 It's a match! Contact details unlocked.", { kind: "success" });
    if (action === "interested") toast("They'll see your location note from the event page. Add one there if you haven't (e.g. “table 4, blue shirt”).");
    refreshPending();
  };

  const showPerson = isOwner ? r.requester : other;

  const context = r.direction === "invite" ? (isOwner ? "You invited them to" : "Invited you to") : (isOwner ? "Wants to join" : "You asked to join");
  const needsMe = canRespond;

  return (
    <article className={cn("rounded-3xl bg-white p-4 ring-1 transition dark:bg-zinc-900 sm:p-5", needsMe ? "ring-2 ring-brand/70 dark:ring-violet-400/70" : "ring-zinc-200/80 dark:ring-zinc-800")}>
      <div className="flex items-start gap-3">
        <Avatar src={showPerson?.avatar_url} name={showPerson?.name ?? ""} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {showPerson ? <Link href={`/u/${showPerson.username}`} className="truncate font-display text-lg font-extrabold leading-tight hover:underline">{showPerson.name || showPerson.username}</Link> : <span className="font-bold">Unknown</span>}
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {context} <Link href={`/p/${r.project_id}`} className="font-bold text-zinc-900 hover:underline dark:text-white">{r.project?.name}</Link>
            {r.slot ? <> as <b className="text-zinc-900 dark:text-white">{r.slot.specialty}</b></> : ""}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{timeAgo(r.created_at)}</p>
        </div>
      </div>

      {isOwner && r.requester && (r.requester.bio || r.requester.skills.length > 0) && (
        <div className="mt-3 space-y-2">
          {r.requester.bio && <p className="text-sm text-zinc-700 dark:text-zinc-300">{r.requester.bio}</p>}
          {r.requester.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{r.requester.skills.map((s) => <span key={s} className={cn("chip", r.slot && s.toLowerCase() === r.slot.specialty.toLowerCase() ? "bg-brand text-white" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")}>{s}</span>)}</div>
          )}
          <LinksRow links={r.requester.links} />
        </div>
      )}
      {r.message && (
        <blockquote className="relative mt-3 rounded-2xl rounded-tl-md bg-zinc-100 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
          {r.message}
        </blockquote>
      )}
      {r.decline_reason && r.status === "declined" && <p className="mt-3 text-sm text-zinc-500">Reason: {r.decline_reason}</p>}

      {r.status === "interested" && isCand && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-sky-50 p-3.5 text-sm text-sky-950 dark:bg-sky-400/10 dark:text-sky-100">
          <span aria-hidden className="text-xl">👋</span>
          <p><b>They want to talk first.</b> {meetNote ? <>Find them at <b className="underline decoration-sky-400 decoration-2 underline-offset-2">{meetNote}</b>.</> : "Look for them in the room."}</p>
        </div>
      )}

      {r.status === "accepted" && (
        <div className="mt-3 rounded-2xl bg-lime-200 p-4 text-zinc-900 dark:bg-lime-300">
          <p className="font-display text-lg font-extrabold">🎉 It&apos;s a match</p>
          <div className="mt-2 space-y-1.5">
            {contact ? (
              <>
                {contact.contact_email && <ContactRow icon="mail" value={contact.contact_email} href={`mailto:${contact.contact_email}`} />}
                {contact.contact_phone && <ContactRow icon="phone" value={contact.contact_phone} href={`tel:${contact.contact_phone}`} />}
                {!contact.contact_email && !contact.contact_phone && <p className="text-sm text-zinc-700">No contact details shared yet. Say hi in the project space.</p>}
              </>
            ) : <div className="h-10 animate-pulse rounded-xl bg-white/50" />}
          </div>
          <Link href={`/space/${r.project_id}`} className="btn mt-3 w-full bg-zinc-900 text-white shadow-[0_4px_0_0_#000] hover:-translate-y-px active:shadow-none">Open project space <Icon name="arrow" className="h-4 w-4" /></Link>
        </div>
      )}

      {canRespond && !declining && (
        <div className="mt-4 space-y-3">
          {isOwner && r.slot_id && r.slot?.status === "open" && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input type="checkbox" className="h-5 w-5 rounded accent-violet-700" checked={fill} onChange={(e) => setFill(e.target.checked)} />
              Mark the {r.slot.specialty} role as filled
            </label>
          )}
          <div className="flex gap-2">
            <button className="btn-accent flex-1" disabled={busy} onClick={() => act("accept")}>{isOwner ? "Accept" : "Join"}</button>
            {isOwner && r.status === "pending" && (
              <button className="btn-secondary flex-1" disabled={busy} onClick={() => act("interested")}>Let&apos;s talk</button>
            )}
            <button className="btn-ghost px-4 text-zinc-500" disabled={busy} onClick={() => (isOwner ? setDeclining(true) : act("decline"))} aria-label="Decline">
              {isOwner ? "Pass" : "Decline"}
            </button>
          </div>
        </div>
      )}
      {declining && (
        <div className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-3.5 dark:bg-zinc-800/50">
          <p className="text-sm font-bold">Want to tell them why? <span className="font-medium text-zinc-500">Optional, kept short and kind.</span></p>
          <div className="flex flex-wrap gap-2">
            {DECLINE_REASONS.map((d) => (
              <button key={d} className="min-h-[38px] rounded-full bg-white px-3.5 text-sm font-semibold ring-1 ring-zinc-200 transition hover:ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-700" disabled={busy} onClick={() => act("decline", d)}>{d}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setDeclining(false)}>Cancel</button>
            <button className="btn-secondary btn-sm ml-auto" disabled={busy} onClick={() => act("decline")}>Pass without a reason</button>
          </div>
        </div>
      )}
      {canWithdraw && <button className="btn-ghost btn-sm mt-3 w-full text-zinc-500" disabled={busy} onClick={() => act("withdraw")}>Withdraw</button>}
    </article>
  );
}

function ContactRow({ icon, value, href }: { icon: "mail" | "phone"; value: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/70 p-1.5 pl-3">
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      <a href={href} className="min-w-0 flex-1 truncate text-sm font-bold underline-offset-2 hover:underline">{value}</a>
      <button onClick={copy} className="flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-2.5 text-xs font-bold text-white" aria-label={`Copy ${value}`}>
        <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function LinksRow({ links }: { links: Profile["links"] }) {
  const entries = LINK_FIELDS.filter((f) => links?.[f.key]);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 text-sm">
      {entries.map((f) => {
        const v = links[f.key]!;
        const href = v.startsWith("http") ? v : `https://${v}`;
        return (
          <a key={f.key} href={href} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 transition hover:bg-violet-100 dark:bg-violet-400/10 dark:text-violet-200">
            {f.label} <Icon name="external" className="h-3 w-3" />
          </a>
        );
      })}
    </div>
  );
}
