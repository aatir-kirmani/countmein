"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import type { JoinRequest, Profile } from "@/lib/types";
import { DECLINE_REASONS, LINK_FIELDS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badges";
import { notify } from "./notify";

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

  useEffect(() => {
    if (r.status === "accepted" && other) {
      supabase.rpc("get_contact", { p_user: other.id }).then(({ data }: { data: { contact_email: string | null; contact_phone: string | null }[] | null }) => setContact(data?.[0] ?? null));
    }
    if (r.status === "interested" && isCand) {
      supabase.rpc("get_meetup_note", { p_request: r.id }).then(({ data }: { data: string | null }) => setMeetNote(data));
    }
  }, [supabase, r.status, r.id, other, isCand]);

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
    if (action === "accept") toast("🎉 You're connected! Contact details unlocked.", { kind: "success" });
    refreshPending();
  };

  const showPerson = isOwner ? r.requester : other;

  return (
    <article className="card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <Avatar src={showPerson?.avatar_url} name={showPerson?.name ?? ""} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showPerson ? <Link href={`/u/${showPerson.username}`} className="font-semibold hover:underline">{showPerson.name || showPerson.username}</Link> : <span className="font-semibold">Unknown</span>}
            <StatusBadge status={r.status} />
          </div>
          <p className="muted text-xs">
            {r.direction === "invite" ? (isOwner ? "You invited them to " : "Invited you to ") : (isOwner ? "Wants to join " : "You asked to join ")}
            <Link href={`/p/${r.project_id}`} className="font-medium underline">{r.project?.name}</Link>
            {r.slot ? ` as ${r.slot.specialty}` : ""} · {timeAgo(r.created_at)}
          </p>
        </div>
      </div>

      {isOwner && r.requester && (
        <div className="space-y-1 text-sm">
          {r.requester.bio && <p>{r.requester.bio}</p>}
          {r.requester.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">{r.requester.skills.map((s) => <span key={s} className="chip bg-zinc-100 dark:bg-zinc-800">{s}</span>)}</div>
          )}
          <LinksRow links={r.requester.links} />
        </div>
      )}
      {r.message && <blockquote className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">“{r.message}”</blockquote>}
      {r.decline_reason && r.status === "declined" && <p className="muted text-sm">Reason: {r.decline_reason}</p>}

      {r.status === "interested" && isCand && (
        <p className="rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-950">👋 The founder wants to talk first. {meetNote ? <>Find them at: <b>{meetNote}</b></> : "Look for them in the room."}</p>
      )}

      {r.status === "accepted" && (
        <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
          <p className="font-semibold">Contact details</p>
          {contact ? (
            <>
              {contact.contact_email && <p>✉ <a className="underline" href={`mailto:${contact.contact_email}`}>{contact.contact_email}</a></p>}
              {contact.contact_phone && <p>☎ <a className="underline" href={`tel:${contact.contact_phone}`}>{contact.contact_phone}</a></p>}
              {!contact.contact_email && !contact.contact_phone && <p className="muted">No contact details shared.</p>}
            </>
          ) : <p className="muted">Loading…</p>}
          <Link href={`/space/${r.project_id}`} className="btn-primary w-full">Open project space</Link>
        </div>
      )}

      {canRespond && !declining && (
        <div className="space-y-2">
          {isOwner && r.slot_id && r.slot?.status === "open" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-violet-700" checked={fill} onChange={(e) => setFill(e.target.checked)} /> Mark {r.slot.specialty} slot as filled
            </label>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => act("accept")}>Accept</button>
            {isOwner && r.status === "pending" ? (
              <button className="btn-secondary" disabled={busy} onClick={() => act("interested")}>Let&apos;s talk</button>
            ) : <span />}
            <button className="btn-secondary" disabled={busy} onClick={() => (isOwner ? setDeclining(true) : act("decline"))}>Decline</button>
          </div>
        </div>
      )}
      {declining && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Reason (optional)</p>
          <div className="flex flex-wrap gap-2">
            {DECLINE_REASONS.map((d) => <button key={d} className="btn-secondary text-xs" disabled={busy} onClick={() => act("decline", d)}>{d}</button>)}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setDeclining(false)}>Cancel</button>
            <button className="btn-danger" disabled={busy} onClick={() => act("decline")}>Decline without reason</button>
          </div>
        </div>
      )}
      {canWithdraw && <button className="btn-ghost w-full text-sm" disabled={busy} onClick={() => act("withdraw")}>Withdraw</button>}
    </article>
  );
}

export function LinksRow({ links }: { links: Profile["links"] }) {
  const entries = LINK_FIELDS.filter((f) => links?.[f.key]);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {entries.map((f) => {
        const v = links[f.key]!;
        const href = v.startsWith("http") ? v : `https://${v}`;
        return <a key={f.key} href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline dark:text-violet-400">{f.label}</a>;
      })}
    </div>
  );
}
