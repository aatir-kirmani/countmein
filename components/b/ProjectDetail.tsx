"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import type { JoinRequest, Profile, ProjectWithRelations, Slot } from "@/lib/types";
import { cn, compLabel, openSlots } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { StageBadge, StatusBadge } from "@/components/ui/Badges";
import { Field } from "@/components/ui/Form";
import { EmptyState, Icon, ProjectLogo, SectionTitle } from "./ui";
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

  const sendable = open.length > 0 || project.openness === "anyone";

  return (
    <div className="space-y-5">
      {backCode && (
        <Link href={`/e/${backCode}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
          <Icon name="back" className="h-4 w-4" /> Back to the board
        </Link>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-white p-5 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-300/40 to-lime-200/40 blur-3xl dark:from-violet-700/30 dark:to-lime-500/10" />
        <div className="relative">
          <div className="flex items-start gap-4">
            <ProjectLogo name={project.name} url={project.logo_url} size={76} className="rounded-3xl" />
            <div className="min-w-0 flex-1 pt-1">
              <StageBadge stage={project.stage} />
              <h1 className="mt-2 text-3xl font-extrabold leading-[1.05] sm:text-4xl">{project.name}</h1>
            </div>
          </div>
          <p className="mt-4 font-display text-xl font-semibold leading-snug text-zinc-800 dark:text-zinc-200">{project.pitch}</p>
          {project.description && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{project.description}</p>}
          {(project.link || project.tech_stack.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {project.link && (
                <a href={project.link.startsWith("http") ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer"
                  className="chip bg-zinc-900 py-1.5 text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                  <Icon name="link" className="h-3.5 w-3.5" /> {project.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              )}
              {project.tech_stack.map((t) => <span key={t} className="chip bg-zinc-100 py-1.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{t}</span>)}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {isMember && <Link href={`/space/${project.id}`} className="btn-primary btn-sm">Open project space</Link>}
            {isOwner && <Link href={`/me/projects/${project.id}/edit`} className="btn-secondary btn-sm">Edit project</Link>}
            <ReportButton targetType="project" targetId={project.id} className="btn-ghost btn-sm ml-auto text-zinc-500" />
          </div>
        </div>
      </section>

      {/* My status */}
      {isMember && !isOwner && (
        <div className="flex items-center gap-3 rounded-3xl bg-lime-200 p-4 text-zinc-900 dark:bg-lime-300">
          <span aria-hidden className="text-2xl">🤝</span>
          <p className="font-bold">You&apos;re on this team.</p>
        </div>
      )}
      {openReq && (
        <div className="flex items-center gap-3 rounded-3xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-lg dark:bg-amber-400/15">⏳</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{openReq.direction === "invite" ? "You've been invited" : openReq.status === "interested" ? "The founder wants to talk" : "Request sent"}</p>
            <p className="text-xs text-zinc-500">{openReq.direction === "invite" ? "Reply from your inbox." : openReq.status === "interested" ? "Check your inbox for where to find them." : "They'll get a ping right away."}</p>
          </div>
          {openReq.direction === "request" ? <button className="btn-ghost btn-sm" onClick={withdraw}>Withdraw</button> : <Link href="/inbox" className="btn-primary btn-sm">Reply</Link>}
        </div>
      )}
      {myReq && !openReq && myReq.status !== "withdrawn" && !isMember && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Your last request: <StatusBadge status={myReq.status} /></p>
      )}

      {/* Openness */}
      {project.openness === "closed" && (
        <div className="flex items-center gap-3 rounded-3xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <span aria-hidden className="text-xl">👀</span> Just showing what they&apos;re building. Not looking for collaborators right now.
        </div>
      )}

      {project.openness === "anyone" && (
        <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 text-white dark:ring-1 dark:ring-zinc-800">
          <div aria-hidden className="absolute -bottom-12 -right-8 text-[8rem] leading-none opacity-20">🙌</div>
          <p className="eyebrow !text-lime-300">Open to anyone</p>
          <h2 className="mt-1 text-2xl font-extrabold">Come build with us</h2>
          {project.general_note && <p className="mt-2 max-w-md text-[15px] text-zinc-300">{project.general_note}</p>}
          {canRequest && <button className="btn-accent relative mt-5 h-14 w-full text-lg" onClick={() => setSheetSlot(null)}>Count me in ✋</button>}
        </section>
      )}

      {project.openness === "specific" && (
        <section>
          <SectionTitle action={<span className="text-xs font-semibold text-zinc-500">{open.length} open</span>}>Open roles</SectionTitle>
          {slots.length === 0 && <p className="text-sm text-zinc-500">No roles listed.</p>}
          {slots.length > 0 && open.length === 0 && !isOwner && (
            <EmptyState emoji="🎯" title="All roles are filled" body="This team is complete for now. Check back later." className="py-8" />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {slots.filter((s) => isOwner || s.status === "open").map((s) => (
              <article key={s.id} className={cn("flex flex-col rounded-3xl p-5 ring-1", s.status === "open" ? "bg-white ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800" : "bg-zinc-100 ring-transparent dark:bg-zinc-900/50")}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-xl font-extrabold leading-tight">{s.specialty}</h3>
                  <span className={cn("chip shrink-0", COMP_COLOR[s.compensation] ?? "bg-zinc-100 dark:bg-zinc-800")}>{compLabel(s.compensation)}</span>
                </div>
                {s.description && <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.description}</p>}
                {s.commitment && <p className="mt-2 text-xs font-semibold text-zinc-500">⏱ {s.commitment}</p>}
                {(isOwner || (canRequest && s.status === "open")) && <div className="mt-auto pt-4">
                  {isOwner ? (
                    <div className="flex items-center gap-2">
                      {s.status !== "open" && <span className="chip bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{s.status === "filled" ? "Filled" : "Closed"}</span>}
                      <div className="ml-auto flex gap-1.5">
                        {s.status === "open" ? (
                          <>
                            <button className="btn-secondary btn-sm" onClick={() => setSlotStatus(s.id, "filled")}>Mark filled</button>
                            <button className="btn-ghost btn-sm" onClick={() => setSlotStatus(s.id, "closed")}>Close</button>
                          </>
                        ) : <button className="btn-secondary btn-sm" onClick={() => setSlotStatus(s.id, "open")}>Reopen</button>}
                      </div>
                    </div>
                  ) : (
                    <button className="btn-primary w-full" onClick={() => setSheetSlot(s.id)}>Count me in</button>
                  )}
                </div>}
              </article>
            ))}
          </div>
        </section>
      )}

      {!me && project.openness !== "closed" && sendable && (
        <Link className="btn-primary h-14 w-full text-base" href={`/login?next=/p/${project.id}${backCode ? `?e=${backCode}` : ""}`}>Sign in to count yourself in</Link>
      )}
      {eventCtx?.ended && !isOwner && <p className="text-sm text-zinc-500">This event has ended, so requests are closed.</p>}

      {/* Founder + team */}
      <section className="card p-5">
        <p className="eyebrow">The founder</p>
        <Link href={`/u/${project.owner.username}`} className="mt-3 flex items-center gap-3">
          <Avatar src={project.owner.avatar_url} name={project.owner.name} size={56} />
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-extrabold">{project.owner.name || project.owner.username}</span>
            <span className="block text-sm text-zinc-500">@{project.owner.username}</span>
          </span>
        </Link>
        {project.owner.bio && <p className="mt-3 text-[15px] text-zinc-700 dark:text-zinc-300">{project.owner.bio}</p>}
        {project.owner.skills?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{project.owner.skills.map((s) => <span key={s} className="chip bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{s}</span>)}</div>}
        <div className="mt-3"><LinksRow links={project.owner.links ?? {}} /></div>

        {members.length > 1 && (
          <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="eyebrow">The team</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m.user_id}>
                  <Link href={`/u/${m.profile.username}`} className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 text-sm transition hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                    <Avatar src={m.profile.avatar_url} name={m.profile.name} size={28} />
                    <span className="font-semibold">{m.profile.name}</span><span className="text-zinc-500">{m.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {isOwner && (
        <section>
          <SectionTitle action={pendingCount > 0 ? <span className="chip bg-brand text-white">{pendingCount} new</span> : undefined}>Requests</SectionTitle>
          {requests === null ? <div className="skeleton h-32 rounded-3xl" /> : requests.length === 0 ? (
            <EmptyState emoji="📬" title="No requests yet" body="When someone taps “Count me in”, they land here instantly." />
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <RequestCard key={r.id} r={r} viewerId={me!.id} onChanged={(id, status) => setRequests((rs) => rs!.map((x) => (x.id === id ? { ...x, status } : x)))} />
              ))}
            </div>
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

const COMP_COLOR: Record<string, string> = {
  equity: "bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200",
  rev_share: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  unpaid: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200",
  tbd: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

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
    toast("Request sent! They'll see it right away. 🙌", { kind: "success" });
    onSent({ id: data as string, project_id: project.id, slot_id: slot || null, requester_id: me.id, event_id: eventId, message, status: "pending", direction: "request", decline_reason: null, created_at: new Date().toISOString(), responded_at: null });
  };

  const chosen = open.find((x) => x.id === slot);
  return (
    <Sheet open onClose={onClose} title="Count me in" subtitle={`Tell ${project.owner?.name?.split(" ")[0] || "the founder"} why you're a fit for ${project.name}.`}>
      <div className="space-y-5">
        {project.openness === "specific" && open.length > 0 && (
          <fieldset>
            <legend className="label">Which role?</legend>
            <div className="grid gap-2">
              {open.map((s) => {
                const on = s.id === slot;
                return (
                  <label key={s.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 ring-1 ring-inset transition",
                    on ? "bg-violet-50 ring-2 ring-brand dark:bg-violet-950/40 dark:ring-violet-400" : "bg-zinc-50 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-800/50 dark:ring-zinc-700")}>
                    <input type="radio" name="req-slot" className="sr-only" checked={on} onChange={() => setSlot(s.id)} />
                    <span aria-hidden className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black", on ? "bg-brand text-white" : "ring-1 ring-inset ring-zinc-300 dark:ring-zinc-600")}>{on ? "✓" : ""}</span>
                    <span className="min-w-0 flex-1 font-bold">{s.specialty}</span>
                    <span className={cn("chip", COMP_COLOR[s.compensation])}>{compLabel(s.compensation)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <Field label="Your pitch" optional htmlFor="req-msg" counter={{ value: message.length, max: 280 }} hint={chosen?.description ? `They're looking for: ${chosen.description}` : undefined}>
          <textarea id="req-msg" className="input" rows={4} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What you'd bring, and when you could start" />
        </Field>
        {me.skills.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-500">Shared with the founder</p>
            <div className="flex flex-wrap gap-1.5">{me.skills.map((k) => <span key={k} className={cn("chip", relevant.includes(k) ? "bg-brand text-white" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")}>{k}</span>)}</div>
          </div>
        )}
        <button className="btn-primary h-14 w-full text-base" disabled={busy || (project.openness === "specific" && !slot)} onClick={send}>{busy ? "Sending…" : "Send request ✋"}</button>
      </div>
    </Sheet>
  );
}
