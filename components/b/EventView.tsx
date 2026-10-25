"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import type { EventRow, Profile, ProjectWithRelations, JoinRequest } from "@/lib/types";
import { LOOKING_FOR, SKILLS, STAGES } from "@/lib/constants";
import { cn, eventStatus, fmtDate, needsMySkills, openSlots } from "@/lib/utils";
import { ProjectCard, ProjectCardSkeleton } from "@/components/ProjectCard";
import { Avatar } from "@/components/ui/Avatar";
import { EventMedia } from "@/components/EventMedia";
import { Empty } from "@/components/ui/Empty";
import { StatusBadge } from "@/components/ui/Badges";
import { Sheet } from "./Sheet";
import { useEventData, type Attendee } from "./useEventData";
import { notify } from "./notify";

type Sponsor = { id: string; name: string; logo_url: string | null; url: string | null; tier: string };
type Tab = "projects" | "people" | "activity";
const LOOKING_LABEL: Record<string, string> = Object.fromEntries(LOOKING_FOR.map((l) => [l.value, l.label]));

export function EventView({ event, profile, initialCheckin, hasTicket, justPaid, sponsors }: {
  event: EventRow; profile: Profile | null; initialCheckin: { location_note: string | null } | null;
  hasTicket: boolean; justPaid: boolean; sponsors: Sponsor[];
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const status = eventStatus(event);
  const ended = status === "ended";
  const isOrganizer = profile?.id === event.organizer_id;
  const [checkin, setCheckin] = useState(initialCheckin);
  const checkedIn = !!checkin;
  const canViewBoard = event.visibility === "public" || checkedIn || isOrganizer;
  const { projects, people, reload } = useEventData(event.id, canViewBoard);
  const [tab, setTab] = useState<Tab>("projects");
  const [bringOpen, setBringOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const doCheckin = async () => {
    if (!profile) return;
    setBusy(true);
    const { data, error } = await supabase.from("event_checkins").insert({ event_id: event.id, user_id: profile.id }).select().single();
    setBusy(false);
    if (error) {
      if (error.code === "23505") { setCheckin({ location_note: null }); reload(); return; } // already checked in (another tab)
      return toast(friendlyCheckinError(error.message), { kind: "error" });
    }
    setCheckin(data);
    toast("You're checked in! 👋", { kind: "success" });
    reload();
    setBringOpen(true);
  };

  const buyTicket = async () => {
    setBusy(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.url) window.location.href = j.url;
    else toast(res.status === 501 ? "Ticket sales aren't set up for this event yet. Ask the organizer to check you in." : j.error || "Couldn't start checkout", { kind: "error" });
  };

  const needsTicket = event.ticket_price_cents > 0 && !hasTicket && !isOrganizer;

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card overflow-hidden">
        <EventMedia event={event} />
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("chip", status === "live" ? "bg-emerald-600 text-white" : status === "ended" ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200")}>
              {status === "live" ? "● Live now" : status === "ended" ? "Ended" : "Upcoming"}
            </span>
            <span className="chip bg-zinc-100 font-mono dark:bg-zinc-800">{event.code}</span>
            {people && <span className="muted text-xs">{people.length} here</span>}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{event.name}</h1>
          <p className="muted text-sm">{fmtDate(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""}{event.city ? `, ${event.city}` : ""}</p>
          {event.capacity && people && <p className="muted text-xs">{Math.max(event.capacity - people.length, 0)} of {event.capacity} spots left</p>}
          {event.description && <p className="whitespace-pre-line text-sm">{event.description}</p>}
          {isOrganizer && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Link className="btn-secondary" href={`/organizer/${event.id}`}>Manage event</Link>
              <Link className="btn-secondary" href={`/e/${event.code}/board`} target="_blank">Open Live Board ↗</Link>
            </div>
          )}
        </div>
      </section>

      {ended && (
        <div role="status" className="card bg-zinc-100 p-3 text-sm dark:bg-zinc-900">This event has ended. The board is read-only and stays browsable for 7 days.</div>
      )}

      {/* Check-in panel */}
      {!profile ? (
        <section className="card space-y-3 p-4">
          <p className="font-semibold">Join the room</p>
          <p className="muted text-sm">Sign in to check in, share what you&apos;re building and team up with people here.</p>
          <Link href={`/login?next=/e/${event.code}`} className="btn-primary w-full">Sign in to check in</Link>
        </section>
      ) : !checkedIn && !ended ? (
        <section className="card space-y-3 p-4">
          {justPaid && !hasTicket && <p className="text-sm text-emerald-700 dark:text-emerald-400">Payment received. Your ticket will be confirmed in a moment; refresh if check-in fails.</p>}
          {needsTicket ? (
            <>
              <p className="font-semibold">Ticket required</p>
              <button className="btn-primary w-full" disabled={busy} onClick={buyTicket}>
                Buy ticket · {(event.ticket_price_cents / 100).toLocaleString(undefined, { style: "currency", currency: event.currency.toUpperCase() })}
              </button>
              {justPaid && <button className="btn-secondary w-full" disabled={busy} onClick={doCheckin}>I&apos;ve paid, check me in</button>}
            </>
          ) : (
            <>
              <button className="btn-primary h-14 w-full text-base" disabled={busy} onClick={doCheckin}>{busy ? "Checking in…" : status === "upcoming" ? "Check in early" : "Check in: I'm here"}</button>
              <p className="muted text-center text-xs">Checking in puts you on the board so people can find you and your projects.</p>
            </>
          )}
        </section>
      ) : ended && !checkedIn ? null : checkedIn ? (
        <CheckedInPanel eventId={event.id} userId={profile.id} note={checkin?.location_note ?? null} ended={ended}
          onNote={(n) => setCheckin({ location_note: n })} onBring={() => setBringOpen(true)} code={event.code} />
      ) : null}

      {sponsors.length > 0 && (
        <section aria-label="Sponsors" className="flex items-center gap-3 overflow-x-auto py-1">
          <span className="muted shrink-0 text-xs uppercase tracking-wide">Sponsors</span>
          {sponsors.map((s) => (
            <a key={s.id} href={s.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              {s.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="" className="h-5 w-5 rounded object-contain" />
              )}
              {s.name}
            </a>
          ))}
        </section>
      )}

      {!canViewBoard ? (
        <Empty title="Check in to see the board" body="Projects and people at this event are visible to checked-in attendees." />
      ) : (
        <>
          <div role="tablist" className="sticky top-14 z-30 -mx-4 grid grid-cols-3 border-b border-zinc-200 bg-zinc-50/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
            {(["projects", "people", "activity"] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cn("min-h-[48px] border-b-2 text-sm font-semibold capitalize", tab === t ? "border-brand text-brand" : "border-transparent muted")}>
                {t === "activity" ? "My activity" : t}
                {t === "projects" && projects ? ` (${projects.length})` : t === "people" && people ? ` (${people.length})` : ""}
              </button>
            ))}
          </div>
          {tab === "projects" && <ProjectsTab projects={projects} people={people} profile={profile} code={event.code} checkedIn={checkedIn} ended={ended} onPost={() => setBringOpen(true)} onPeople={() => setTab("people")} />}
          {tab === "people" && <PeopleTab people={people} profile={profile} event={event} ended={ended} checkedIn={checkedIn} />}
          {tab === "activity" && (profile ? <ActivityTab eventId={event.id} code={event.code} profile={profile} projects={projects} /> : <Empty title="Sign in to see your activity" />)}
        </>
      )}

      {profile && <BringProjectSheet open={bringOpen} onClose={() => setBringOpen(false)} eventId={event.id} code={event.code} userId={profile.id} onAdded={reload} />}
    </div>
  );
}

function CheckedInPanel({ eventId, userId, note, ended, onNote, onBring, code }: {
  eventId: string; userId: string; note: string | null; ended: boolean; onNote: (n: string | null) => void; onBring: () => void; code: string;
}) {
  const supabase = createClient();
  const { toast } = useApp();
  const [val, setVal] = useState(note ?? "");
  const [editing, setEditing] = useState(false);
  const save = async () => {
    const v = val.trim() || null;
    onNote(v); setEditing(false);
    const { error } = await supabase.from("event_checkins").update({ location_note: v }).eq("event_id", eventId).eq("user_id", userId);
    if (error) toast(error.message, { kind: "error" });
  };
  return (
    <section className="card space-y-3 p-4">
      <p className="font-semibold text-emerald-700 dark:text-emerald-400">✓ You&apos;re here</p>
      {editing ? (
        <div className="flex gap-2">
          <input className="input" maxLength={80} autoFocus placeholder="e.g. table 4, blue shirt" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Where can people find you?" onKeyDown={(e) => e.key === "Enter" && save()} />
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      ) : (
        <button className="btn-ghost -mx-2 justify-start text-left text-sm" onClick={() => setEditing(true)}>
          📍 {note || "Add where people can find you (shared only when you say “Let's talk first”)"}
        </button>
      )}
      {!ended && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={onBring}>Bring a project</button>
          <Link className="btn-secondary" href={`/me/projects/new?event=${code}`}>Post new project</Link>
        </div>
      )}
    </section>
  );
}

function BringProjectSheet({ open, onClose, eventId, code, userId, onAdded }: { open: boolean; onClose: () => void; eventId: string; code: string; userId: string; onAdded: () => void }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [mine, setMine] = useState<{ id: string; name: string; pitch: string }[] | null>(null);
  const [here, setHere] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: p }, { data: ep }] = await Promise.all([
        supabase.from("projects").select("id,name,pitch").eq("owner_id", userId).order("created_at", { ascending: false }),
        supabase.from("event_projects").select("project_id").eq("event_id", eventId),
      ]);
      setMine(p ?? []);
      setHere(new Set((ep ?? []).map((r: { project_id: string }) => r.project_id)));
    })();
  }, [open, supabase, userId, eventId]);

  const toggle = async (id: string) => {
    const on = here.has(id);
    const next = new Set(here);
    if (on) next.delete(id); else next.add(id);
    setHere(next); // optimistic
    const { error } = on
      ? await supabase.from("event_projects").delete().eq("event_id", eventId).eq("project_id", id)
      : await supabase.from("event_projects").insert({ event_id: eventId, project_id: id });
    if (error) { toast(error.message, { kind: "error" }); setHere(here); }
    else { if (!on) toast("Project is on the board!", { kind: "success" }); onAdded(); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Bring a project">
      {mine === null ? (
        <div className="space-y-2"><div className="skeleton h-14" /><div className="skeleton h-14" /></div>
      ) : (
        <div className="space-y-2">
          {mine.length === 0 && <p className="muted text-sm">You haven&apos;t posted a project yet.</p>}
          {mine.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={here.has(p.id)}
              className={cn("flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left ring-1", here.has(p.id) ? "bg-brand-soft ring-brand dark:bg-violet-950" : "ring-zinc-200 dark:ring-zinc-800")}>
              <span className="min-w-0"><span className="block truncate font-semibold">{p.name}</span><span className="muted block truncate text-sm">{p.pitch}</span></span>
              <span className="shrink-0 text-sm font-semibold">{here.has(p.id) ? "✓ Showing" : "+ Show"}</span>
            </button>
          ))}
          <Link href={`/me/projects/new?event=${code}`} className="btn-secondary w-full">+ Post a new project</Link>
        </div>
      )}
    </Sheet>
  );
}

function ProjectsTab({ projects, people, profile, code, checkedIn, ended, onPost, onPeople }: {
  projects: ProjectWithRelations[] | null; people: Attendee[] | null; profile: Profile | null; code: string; checkedIn: boolean; ended: boolean; onPost: () => void; onPeople: () => void;
}) {
  const mySkills = profile?.skills ?? [];
  const [mineOnly, setMineOnly] = useState(mySkills.length > 0);
  const [specialty, setSpecialty] = useState("");
  const [stage, setStage] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!projects) return null;
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (mineOnly && p.owner_id !== profile?.id && !needsMySkills(p, mySkills)) return false;
      if (specialty && !openSlots(p).some((s) => s.specialty.toLowerCase() === specialty.toLowerCase())) return false;
      if (stage && p.stage !== stage) return false;
      if (openOnly && p.openness === "closed") return false;
      if (openOnly && p.openness === "specific" && openSlots(p).length === 0) return false;
      if (term) {
        const hay = `${p.name} ${p.pitch} ${p.description ?? ""} ${p.tech_stack.join(" ")} ${p.owner?.name ?? ""} ${p.project_slots.map((s) => s.specialty).join(" ")}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [projects, mineOnly, specialty, stage, openOnly, q, mySkills, profile?.id]);

  // Smart match: people here whose skills cover my projects' open slots.
  const smartMatch = useMemo(() => {
    if (!profile || !projects || !people) return 0;
    const needed = new Set(projects.filter((p) => p.owner_id === profile.id).flatMap((p) => openSlots(p).map((s) => s.specialty.toLowerCase())));
    if (!needed.size) return 0;
    return people.filter((a) => a.user_id !== profile.id && a.profile.skills.some((s) => needed.has(s.toLowerCase()))).length;
  }, [profile, projects, people]);

  return (
    <div className="space-y-3">
      {smartMatch > 0 && (
        <div className="card flex items-center justify-between gap-2 bg-brand-soft p-3 text-sm dark:bg-violet-950">
          <span>✨ <b>{smartMatch}</b> {smartMatch === 1 ? "person here has" : "people here have"} the skills you need</span>
          <button className="shrink-0 font-semibold text-brand underline dark:text-violet-300" onClick={onPeople}>See who</button>
        </div>
      )}
      <input type="search" className="input" placeholder="Search projects, stacks, people…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {mySkills.length > 0 && (
          <button aria-pressed={mineOnly} onClick={() => setMineOnly(!mineOnly)} className={cn("chip min-h-[36px] shrink-0 px-3 ring-1", mineOnly ? "bg-brand text-white ring-brand" : "ring-zinc-300 dark:ring-zinc-700")}>Needs my skills</button>
        )}
        <button aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)} className={cn("chip min-h-[36px] shrink-0 px-3 ring-1", openOnly ? "bg-brand text-white ring-brand" : "ring-zinc-300 dark:ring-zinc-700")}>Open only</button>
        <select className="chip min-h-[36px] shrink-0 bg-transparent px-3 ring-1 ring-zinc-300 dark:ring-zinc-700" value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label="Filter by specialty">
          <option value="">Any specialty</option>
          {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="chip min-h-[36px] shrink-0 bg-transparent px-3 ring-1 ring-zinc-300 dark:ring-zinc-700" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
          <option value="">Any stage</option>
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {mineOnly && filtered && projects && filtered.length > 0 && filtered.length < projects.length && (
        <p className="muted text-xs">
          Showing {filtered.length} of {projects.length} projects that need your skills.{" "}
          <button className="font-semibold text-brand underline dark:text-violet-300" onClick={() => setMineOnly(false)}>Show all</button>
        </p>
      )}
      {filtered === null ? (
        <div className="space-y-3"><ProjectCardSkeleton /><ProjectCardSkeleton /><ProjectCardSkeleton /></div>
      ) : projects!.length === 0 ? (
        <Empty title="No projects yet. Be the first to post yours." body={!checkedIn && !ended ? "Check in above to post a project." : undefined} action={checkedIn && !ended && <button className="btn-primary" onClick={onPost}>Post your project</button>} />
      ) : filtered.length === 0 ? (
        <Empty title="Nothing matches these filters" body={mineOnly ? `No project here is looking for ${mySkills.join(", ")} yet. Turn off “Needs my skills” to see everything.` : undefined}
          action={<button className="btn-secondary" onClick={() => { setMineOnly(false); setSpecialty(""); setStage(""); setOpenOnly(false); setQ(""); }}>Clear filters</button>} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => <li key={p.id}><ProjectCard p={p} eventCode={code} /></li>)}
        </ul>
      )}
    </div>
  );
}

function PeopleTab({ people, profile, event, ended, checkedIn }: { people: Attendee[] | null; profile: Profile | null; event: EventRow; ended: boolean; checkedIn: boolean }) {
  const [skill, setSkill] = useState("");
  const [q, setQ] = useState("");
  const [inviting, setInviting] = useState<Attendee | null>(null);
  const filtered = useMemo(() => {
    if (!people) return null;
    const term = q.trim().toLowerCase();
    return people.filter((a) => {
      if (skill && !a.profile.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return false;
      if (term && !`${a.profile.name} ${a.profile.username} ${a.profile.bio ?? ""} ${a.profile.skills.join(" ")}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [people, skill, q]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="search" className="input" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        <select className="input w-40" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Filter by skill">
          <option value="">All skills</option>
          {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {filtered === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Empty title={people!.length ? "No one matches" : "No one has checked in yet"} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => (
            <li key={a.user_id} className="card flex items-center gap-3 p-3">
              <Link href={`/u/${a.profile.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={a.profile.avatar_url} name={a.profile.name} size={44} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.profile.name || a.profile.username}</span>
                  <span className="muted block truncate text-xs">{a.profile.skills.join(" · ") || a.profile.bio}</span>
                  {a.profile.looking_for?.length > 0 && <span className="block truncate text-[11px] text-violet-700 dark:text-violet-300">Looking for: {a.profile.looking_for.map((l) => LOOKING_LABEL[l] ?? l).join(", ")}</span>}
                </span>
              </Link>
              {profile && checkedIn && a.user_id !== profile.id && !ended && (
                <button className="btn-secondary shrink-0 px-3 text-xs" onClick={() => setInviting(a)}>Invite</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {profile && inviting && <InviteSheet attendee={inviting} profile={profile} event={event} onClose={() => setInviting(null)} />}
    </div>
  );
}

function InviteSheet({ attendee, profile, event, onClose }: { attendee: Attendee; profile: Profile; event: EventRow; onClose: () => void }) {
  const eventId = event.id;
  const supabase = createClient();
  const { toast } = useApp();
  const [mine, setMine] = useState<ProjectWithRelations[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("*, project_slots(*)").eq("owner_id", profile.id).neq("openness", "closed").order("created_at", { ascending: false })
      .then(({ data }: { data: ProjectWithRelations[] | null }) => {
        setMine(data ?? []);
        if (data?.[0]) setProjectId(data[0].id);
      });
  }, [supabase, profile.id]);

  const project = mine?.find((p) => p.id === projectId);
  const slots = project ? openSlots(project) : [];

  const send = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_join_request", {
      p_project: projectId, p_slot: slotId || null, p_event: eventId, p_message: message || null, p_candidate: attendee.user_id,
    });
    setBusy(false);
    if (error) return toast(error.message, { kind: "error" });
    notify(data as string);
    toast(`Invite sent to ${attendee.profile.name}`, { kind: "success" });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`Invite ${attendee.profile.name || attendee.profile.username}`}>
      {mine === null ? <div className="skeleton h-24" /> : mine.length === 0 ? (
        <p className="muted text-sm">You need a project that&apos;s open to collaborators to invite people. <Link className="text-brand underline" href={`/me/projects/new?event=${event.code}`}>Post one</Link></p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="inv-proj">Project</label>
            <select id="inv-proj" className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSlotId(""); }}>
              {mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="inv-slot">Role</label>
            <select id="inv-slot" className="input" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">General collaborator</option>
              {slots.map((s) => <option key={s.id} value={s.id}>{s.specialty}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="inv-msg">Message (optional)</label>
            <textarea id="inv-msg" className="input" rows={3} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why you'd love to work together" />
            <p className="muted text-right text-xs">{message.length}/280</p>
          </div>
          <button className="btn-primary w-full" disabled={busy || !projectId} onClick={send}>{busy ? "Sending…" : "Send invite"}</button>
        </div>
      )}
    </Sheet>
  );
}

type ReqWithProject = JoinRequest & { project: { id: string; name: string } | null; slot: { specialty: string } | null };

function ActivityTab({ eventId, code, profile, projects }: { eventId: string; code: string; profile: Profile; projects: ProjectWithRelations[] | null }) {
  const supabase = createClient();
  const [mine, setMine] = useState<ReqWithProject[] | null>(null);
  const [pending, setPending] = useState<Record<string, number>>({});
  const myProjects = useMemo(() => (projects ?? []).filter((p) => p.owner_id === profile.id), [projects, profile.id]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("join_requests").select("*, project:projects(id,name), slot:project_slots(specialty)")
      .eq("requester_id", profile.id).eq("event_id", eventId).order("created_at", { ascending: false });
    setMine((data ?? []) as ReqWithProject[]);
    if (myProjects.length) {
      const { data: r } = await supabase.from("join_requests").select("project_id")
        .in("project_id", myProjects.map((p) => p.id)).eq("direction", "request").eq("status", "pending");
      const counts: Record<string, number> = {};
      (r ?? []).forEach((x: { project_id: string }) => { counts[x.project_id] = (counts[x.project_id] ?? 0) + 1; });
      setPending(counts);
    }
  }, [supabase, profile.id, eventId, myProjects]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`activity:${eventId}:${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, load, eventId, profile.id]);

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 font-semibold">My projects here</h2>
        {myProjects.length === 0 ? <p className="muted text-sm">You haven&apos;t brought a project to this event yet.</p> : (
          <ul className="space-y-2">
            {myProjects.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}?e=${code}`} className="card flex items-center justify-between p-3">
                  <span className="font-medium">{p.name}</span>
                  {pending[p.id] ? <span className="chip bg-brand text-white">{pending[p.id]} pending</span> : <span className="muted text-xs">No pending requests</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">My requests &amp; invites</h2>
        {mine === null ? <div className="skeleton h-16" /> : mine.length === 0 ? <p className="muted text-sm">Nothing yet. Find a project and tap “Count me in”.</p> : (
          <ul className="space-y-2">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={r.status === "accepted" ? `/space/${r.project_id}` : `/p/${r.project_id}?e=${code}`} className="card flex items-center justify-between gap-2 p-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.project?.name}</span>
                    <span className="muted text-xs">{r.direction === "invite" ? "Invited you" : "You requested"}{r.slot ? ` · ${r.slot.specialty}` : ""}{r.status === "pending" && r.direction === "invite" ? " · respond in Inbox" : ""}{r.status === "accepted" ? " · open space →" : ""}</span>
                  </span>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function friendlyCheckinError(msg: string) {
  if (/capacity/i.test(msg)) return "Sorry, this event is full.";
  if (/invite-only/i.test(msg)) return "This event is invite-only and your email isn't on the guest list.";
  if (/ticket/i.test(msg)) return "You need a ticket to check in.";
  if (/ended/i.test(msg)) return "This event has already ended.";
  if (/row-level security/i.test(msg)) return "You don't have access to check in to this event.";
  return msg;
}
