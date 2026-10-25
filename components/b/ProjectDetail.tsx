"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import type { JoinRequest, Profile, ProjectWithRelations, Slot } from "@/lib/types";
import { compLabel, openSlots } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { StageBadge, StatusBadge } from "@/components/ui/Badges";
import { Empty } from "@/components/ui/Empty";
import { ReportButton } from "@/components/ReportButton";
import { Sheet } from "./Sheet";
import { LinksRow, REQUEST_SELECT, RequestCard, type FullRequest } from "./RequestCard";
import { notify } from "./notify";

type Owner = ProjectWithRelations["owner"] & Pick<Profile, "bio" | "links">;
type Member = { user_id: string; role: string; profile: Pick<Profile, "id" | "name" | "username" | "avatar_url"> };

export function ProjectDetail({ project, members, me, eventCtx, backCode }: {
  project: ProjectWithRelations & { owner: Owner }; members: Member[]; me: Profile | null;
  eventCtx: { id: string; code: string; ended: boolean } | null; backCode: string | null;
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const isOwner = me?.id === project.owner_id;
  const isMember = !!me && members.some((m) => m.user_id === me.id);
  const [slots, setSlots] = useState<Slot[]>(project.project_slots ?? []);
  const [myReq, setMyReq] = useState<JoinRequest | null>(null);
  const [sheetSlot, setSheetSlot] = useState<string | null | undefined>(undefined); // undefined = closed, null = general
  const [requests, setRequests] = useState<FullRequest[] | null>(null);

  const loadMine = useCallback(async () => {
    if (!me || isOwner) return;
    const { data } = await supabase.from("join_requests").select("*").eq("project_id", project.id).eq("requester_id", me.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setMyReq(data as JoinRequest | null);
  }, [supabase, me, isOwner, project.id]);

  const loadRequests = useCallback(async () => {
    if (!isOwner) return;
    const { data } = await supabase.from("join_requests").select(REQUEST_SELECT).eq("project_id", project.id).order("created_at", { ascending: false });
    setRequests((data ?? []) as FullRequest[]);
  }, [supabase, isOwner, project.id]);

  useEffect(() => {
    loadMine(); loadRequests();
    if (!me) return;
    const ch = supabase.channel(`project:${project.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests", filter: `project_id=eq.${project.id}` }, () => { loadMine(); loadRequests(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_slots", filter: `project_id=eq.${project.id}` }, async () => {
        const { data } = await supabase.from("project_slots").select("*").eq("project_id", project.id).order("created_at");
        setSlots((data ?? []) as Slot[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, project.id, me, loadMine, loadRequests]);

  const setSlotStatus = async (id: string, status: Slot["status"]) => {
    const prev = slots;
    setSlots((s) => s.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from("project_slots").update({ status }).eq("id", id);
    if (error) { setSlots(prev); toast(error.message, { kind: "error" }); }
  };

  const openReq = myReq && (myReq.status === "pending" || myReq.status === "interested") ? myReq : null;
  const canRequest = !!me && !isOwner && !isMember && !openReq && !eventCtx?.ended && project.openness !== "closed";
  const live = { ...project, project_slots: slots };
  const open = openSlots(live);

  const withdraw = async () => {
    if (!openReq) return;
    setMyReq({ ...openReq, status: "withdrawn" });
    const { error } = await supabase.rpc("respond_join_request", { p_id: openReq.id, p_action: "withdraw" });
    if (error) { setMyReq(openReq); toast(error.message, { kind: "error" }); }
  };

  const pendingCount = (requests ?? []).filter((r) => r.status === "pending" && r.direction === "request").length;

  return (
    <div className="space-y-4">
      {backCode && <Link href={`/e/${backCode}`} className="btn-ghost -ml-2 text-sm">← Back to event</Link>}

      <section className="card space-y-3 p-4">
        <div className="flex gap-3">
          {project.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-2xl font-bold dark:bg-zinc-800">{project.name[0]}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight">{project.name}</h1><StageBadge stage={project.stage} /></div>
            <p className="muted">{project.pitch}</p>
          </div>
        </div>
        {project.description && <p className="whitespace-pre-line text-sm">{project.description}</p>}
        {project.link && (
          <a href={project.link.startsWith("http") ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline dark:text-violet-400">{project.link}</a>
        )}
        {project.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1">{project.tech_stack.map((t) => <span key={t} className="chip bg-zinc-100 dark:bg-zinc-800">{t}</span>)}</div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {isOwner && <Link href={`/me/projects/${project.id}/edit`} className="btn-secondary">Edit project</Link>}
          {isMember && <Link href={`/space/${project.id}`} className="btn-primary">Open project space</Link>}
          <ReportButton targetType="project" targetId={project.id} />
        </div>
      </section>

      {/* Openness */}
      <section className="space-y-3">
        {project.openness === "closed" && <p className="muted text-sm">Just showing what I&apos;m building. Not looking for collaborators right now.</p>}

        {project.openness === "anyone" && (
          <div className="card space-y-3 p-4">
            <p className="font-semibold">🙌 Open to anyone</p>
            {project.general_note && <p className="text-sm">{project.general_note}</p>}
            {canRequest && <button className="btn-primary h-12 w-full text-base" onClick={() => setSheetSlot(null)}>Count me in</button>}
          </div>
        )}

        {project.openness === "specific" && (
          <>
            <h2 className="font-semibold">Open roles</h2>
            {slots.length === 0 && <p className="muted text-sm">No roles listed.</p>}
            {slots.length > 0 && open.length === 0 && !isOwner && <p className="muted text-sm">All roles are filled right now. Check back later.</p>}
            {slots.map((s) => (
              <div key={s.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{s.specialty}</p>
                  <div className="flex gap-1">
                    <span className="chip bg-zinc-100 dark:bg-zinc-800">{compLabel(s.compensation)}</span>
                    {s.status !== "open" && <span className="chip bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">{s.status === "filled" ? "Filled" : "Closed"}</span>}
                  </div>
                </div>
                {s.description && <p className="text-sm">{s.description}</p>}
                {s.commitment && <p className="muted text-xs">Commitment: {s.commitment}</p>}
                {isOwner ? (
                  <div className="flex gap-2">
                    {s.status === "open" ? (
                      <>
                        <button className="btn-secondary text-xs" onClick={() => setSlotStatus(s.id, "filled")}>Mark filled</button>
                        <button className="btn-ghost text-xs" onClick={() => setSlotStatus(s.id, "closed")}>Close</button>
                      </>
                    ) : <button className="btn-secondary text-xs" onClick={() => setSlotStatus(s.id, "open")}>Reopen</button>}
                  </div>
                ) : canRequest && s.status === "open" ? (
                  <button className="btn-primary w-full" onClick={() => setSheetSlot(s.id)}>Count me in</button>
                ) : null}
              </div>
            ))}
          </>
        )}

        {!me && project.openness !== "closed" && (
          <Link className="btn-primary w-full" href={`/login?next=/p/${project.id}${backCode ? `?e=${backCode}` : ""}`}>Sign in to join</Link>
        )}
        {eventCtx?.ended && !isOwner && <p className="muted text-sm">This event has ended, so requests are closed.</p>}
        {isMember && !isOwner && <p className="text-sm text-emerald-700 dark:text-emerald-400">✓ You&apos;re on this team.</p>}
        {openReq && (
          <div className="card flex items-center justify-between gap-2 p-4">
            <span className="text-sm">Your request <StatusBadge status={openReq.status} /></span>
            {openReq.direction === "request" ? <button className="btn-ghost text-sm" onClick={withdraw}>Withdraw</button> : <Link href="/inbox" className="btn-secondary text-sm">Respond</Link>}
          </div>
        )}
        {myReq && !openReq && myReq.status !== "withdrawn" && !isMember && (
          <p className="muted text-sm">Your last request: <StatusBadge status={myReq.status} /></p>
        )}
      </section>

      {/* Founder */}
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Founder</h2>
        <Link href={`/u/${project.owner.username}`} className="flex items-center gap-3">
          <Avatar src={project.owner.avatar_url} name={project.owner.name} size={48} />
          <span><span className="block font-semibold">{project.owner.name || project.owner.username}</span><span className="muted text-xs">@{project.owner.username}</span></span>
        </Link>
        {project.owner.bio && <p className="text-sm">{project.owner.bio}</p>}
        {project.owner.skills?.length > 0 && <div className="flex flex-wrap gap-1">{project.owner.skills.map((s) => <span key={s} className="chip bg-zinc-100 dark:bg-zinc-800">{s}</span>)}</div>}
        <LinksRow links={project.owner.links ?? {}} />
      </section>

      {members.length > 1 && (
        <section className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Team</h2>
          <ul className="flex flex-wrap gap-3">
            {members.map((m) => (
              <li key={m.user_id}><Link href={`/u/${m.profile.username}`} className="flex items-center gap-2 text-sm"><Avatar src={m.profile.avatar_url} name={m.profile.name} size={28} />{m.profile.name} <span className="muted">· {m.role}</span></Link></li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && (
        <section className="space-y-3">
          <h2 className="font-semibold">Requests {pendingCount > 0 && <span className="chip bg-brand text-white">{pendingCount} new</span>}</h2>
          {requests === null ? <div className="skeleton h-24" /> : requests.length === 0 ? (
            <Empty title="No requests yet" body="When someone taps “Count me in”, they'll appear here instantly." />
          ) : (
            requests.map((r) => (
              <RequestCard key={r.id} r={r} viewerId={me!.id} onChanged={(id, status) => setRequests((rs) => rs!.map((x) => (x.id === id ? { ...x, status } : x)))} />
            ))
          )}
        </section>
      )}

      {me && sheetSlot !== undefined && (
        <RequestSheet project={live} slotId={sheetSlot} me={me} eventId={eventCtx?.id ?? null} open={open}
          onClose={() => setSheetSlot(undefined)} onSent={(r) => { setMyReq(r); setSheetSlot(undefined); }} />
      )}
    </div>
  );
}

function RequestSheet({ project, slotId, me, eventId, open, onClose, onSent }: {
  project: ProjectWithRelations; slotId: string | null; me: Profile; eventId: string | null; open: Slot[];
  onClose: () => void; onSent: (r: JoinRequest) => void;
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const [slot, setSlot] = useState<string>(slotId ?? "");
  const relevant = useMemo(() => {
    const s = open.find((x) => x.id === slot);
    const mine = me.skills;
    const match = s ? mine.filter((k) => k.toLowerCase() === s.specialty.toLowerCase()) : [];
    return (match.length ? match : mine).slice(0, 4);
  }, [open, slot, me.skills]);
  const [message, setMessage] = useState(relevant.length ? `Hi! I'm into ${relevant.join(", ")}. ` : "");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_join_request", { p_project: project.id, p_slot: slot || null, p_event: eventId, p_message: message.trim() || null });
    setBusy(false);
    if (error) return toast(error.message, { kind: "error" });
    notify(data as string);
    toast("Request sent! The founder will see it right away.", { kind: "success" });
    onSent({ id: data as string, project_id: project.id, slot_id: slot || null, requester_id: me.id, event_id: eventId, message, status: "pending", direction: "request", decline_reason: null, created_at: new Date().toISOString(), responded_at: null });
  };

  return (
    <Sheet open onClose={onClose} title={`Count me in: ${project.name}`}>
      <div className="space-y-3">
        {project.openness === "specific" && open.length > 0 && (
          <div>
            <label className="label" htmlFor="req-slot">Role</label>
            <select id="req-slot" className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {open.map((s) => <option key={s.id} value={s.id}>{s.specialty} · {compLabel(s.compensation)}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="req-msg">Message (optional)</label>
          <textarea id="req-msg" className="input" rows={4} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What you'd bring to the project" />
          <p className="muted text-right text-xs">{message.length}/280</p>
        </div>
        {me.skills.length > 0 && <p className="muted text-xs">Your skills are shared with the founder: {me.skills.join(", ")}</p>}
        <button className="btn-primary h-12 w-full text-base" disabled={busy || (project.openness === "specific" && !slot)} onClick={send}>{busy ? "Sending…" : "Send request"}</button>
      </div>
    </Sheet>
  );
}
