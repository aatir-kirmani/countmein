"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { ReportButton } from "@/components/ReportButton";
import { cn, timeAgo } from "@/lib/utils";
import { Field } from "@/components/ui/Form";
import type { Message, Task } from "@/lib/types";

type Member = {
  user_id: string;
  role: string;
  joined_at: string;
  profile: { id: string; name: string; username: string; avatar_url: string | null } | null;
};
type Contact = { contact_email: string | null; contact_phone: string | null };
type LinkRow = { id: string; author_id: string; title: string; url: string | null; note: string | null; created_at: string };
type Proj = { id: string; name: string; pitch: string; owner_id: string; logo_url: string | null };

const TABS = ["Chat", "Members", "Tasks", "Links"] as const;

export function SpaceClient({ project, userId }: { project: Proj; userId: string }) {
  const supabase = createClient();
  const { toast } = useApp();
  const router = useRouter();
  const isOwner = project.owner_id === userId;
  const [tab, setTab] = useState<(typeof TABS)[number]>("Chat");
  const [members, setMembers] = useState<Member[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from("project_members")
      .select("user_id, role, joined_at, profile:profiles(id,name,username,avatar_url)")
      .eq("project_id", project.id)
      .order("joined_at");
    const rows = (data ?? []) as unknown as Member[];
    // Removed by the founder (or left from another tab): send them out with an explanation.
    if (rows.length && !rows.some((m) => m.user_id === userId)) {
      toast("You're no longer a member of this project.");
      router.replace(`/p/${project.id}`);
      return;
    }
    setMembers(rows);
    const entries = await Promise.all(
      rows.map(async (m) => {
        const { data: c } = await supabase.rpc("get_contact", { p_user: m.user_id });
        return [m.user_id, (c?.[0] ?? { contact_email: null, contact_phone: null }) as Contact] as const;
      })
    );
    setContacts(Object.fromEntries(entries));
  }, [supabase, project.id, userId, toast, router]);

  useEffect(() => {
    loadMembers();
    const ch = supabase
      .channel(`members:${project.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${project.id}` }, loadMembers)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, project.id, loadMembers]);

  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.profile?.name || "Someone";

  const removeMember = async (uid: string, self = false) => {
    if (!confirm(self ? "Leave this project?" : "Remove this member?")) return;
    const { error } = await supabase.from("project_members").delete().eq("project_id", project.id).eq("user_id", uid);
    if (error) return toast(error.message, { kind: "error" });
    if (self) router.push("/me");
    else loadMembers();
  };

  const changeRole = async (uid: string, role: string) => {
    const { error } = await supabase.from("project_members").update({ role }).eq("project_id", project.id).eq("user_id", uid);
    if (error) toast(error.message, { kind: "error" });
    else setMembers((ms) => ms.map((m) => (m.user_id === uid ? { ...m, role } : m)));
  };

  const counts: Record<(typeof TABS)[number], number | null> = { Chat: null, Members: members.length, Tasks: null, Links: null };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        {project.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-800" />
        ) : (
          <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-lime-300 font-display text-2xl font-extrabold text-white">{project.name[0]}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Project space</p>
          <h1 className="truncate text-2xl font-extrabold leading-tight">{project.name}</h1>
          <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{project.pitch}</p>
        </div>
        <Link href={`/p/${project.id}`} className="btn-secondary btn-sm hidden sm:inline-flex">Project page</Link>
      </header>

      <div className="flex items-center gap-2">
        <div className="flex -space-x-2" aria-label={`${members.length} members`}>
          {members.slice(0, 5).map((m) => (
            <span key={m.user_id} className="rounded-full ring-2 ring-zinc-50 dark:ring-zinc-950"><Avatar src={m.profile?.avatar_url} name={m.profile?.name ?? ""} size={28} /></span>
          ))}
        </div>
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{members.length} on the team</span>
        <Link href={`/p/${project.id}`} className="ml-auto text-xs font-bold text-brand sm:hidden dark:text-violet-300">Project page →</Link>
      </div>

      <div role="tablist" aria-label="Space sections" className="flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {TABS.map((t) => (
          <button
            key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn(
              "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition",
              tab === t ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            {t}
            {counts[t] ? <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] tabular-nums dark:bg-zinc-600">{counts[t]}</span> : null}
          </button>
        ))}
      </div>

      {tab === "Chat" && <Chat projectId={project.id} userId={userId} isOwner={isOwner} members={members} />}

      {tab === "Members" && (
        <ul className="space-y-2.5">
          {members.map((m) => {
            const c = contacts[m.user_id];
            const isMe = m.user_id === userId;
            const isFounder = m.user_id === project.owner_id;
            return (
              <li key={m.user_id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={m.profile?.avatar_url} name={m.profile?.name ?? ""} size={48} />
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <Link href={`/u/${m.profile?.username}`} className="font-bold hover:text-brand">
                      {m.profile?.name || m.profile?.username}
                      {isMe && <span className="ml-1 text-sm font-medium text-zinc-500">(you)</span>}
                    </Link>
                    {isOwner && !isFounder ? (
                      <input
                        className="input mt-1.5 h-9 w-full max-w-[220px] rounded-xl bg-violet-50 px-3 text-sm font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-200" title="Tap to edit role" defaultValue={m.role} aria-label={`Role for ${m.profile?.name ?? "member"}`}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== m.role && changeRole(m.user_id, e.target.value.trim())}
                      />
                    ) : (
                      <span className={cn("chip mt-1 w-fit", isFounder ? "bg-lime-300 text-zinc-900" : "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200")}>{m.role}</span>
                    )}
                  </div>
                </div>
                {c && (c.contact_email || c.contact_phone) && !isMe && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {c.contact_email && (
                      <a href={`mailto:${c.contact_email}`} className="flex min-w-0 items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-medium ring-1 ring-inset ring-zinc-200 hover:ring-brand dark:bg-zinc-950 dark:ring-zinc-800">
                        <span aria-hidden>✉️</span><span className="truncate">{c.contact_email}</span>
                      </a>
                    )}
                    {c.contact_phone && (
                      <a href={`tel:${c.contact_phone}`} className="flex min-w-0 items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-medium ring-1 ring-inset ring-zinc-200 hover:ring-brand dark:bg-zinc-950 dark:ring-zinc-800">
                        <span aria-hidden>📞</span><span className="truncate">{c.contact_phone}</span>
                      </a>
                    )}
                  </div>
                )}
                {((isOwner && !isFounder) || (isMe && !isOwner)) && (
                  <div className="mt-3 flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    {isOwner && !isFounder && <button className="btn-ghost btn-sm text-red-600" onClick={() => removeMember(m.user_id)}>Remove from team</button>}
                    {isMe && !isOwner && <button className="btn-ghost btn-sm text-red-600" onClick={() => removeMember(m.user_id, true)}>Leave project</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tab === "Tasks" && <Tasks projectId={project.id} members={members} nameOf={nameOf} />}
      {tab === "Links" && <Links projectId={project.id} userId={userId} isOwner={isOwner} nameOf={nameOf} />}
    </div>
  );
}

function dayLabel(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const clock = (d: string) => new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Chat({ projectId, userId, isOwner, members }: { projectId: string; userId: string; isOwner: boolean; members: Member[] }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [msgs, setMsgs] = useState<(Message & { pending?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.from("messages").select("*").eq("project_id", projectId).order("created_at").limit(500)
      .then(({ data }: { data: Message[] | null }) => { setMsgs(data ?? []); setLoading(false); });
    const ch = supabase
      .channel(`messages:${projectId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        (p: { new: Message }) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m.filter((x) => !(x.pending && x.body === p.new.body && x.sender_id === p.new.sender_id)), p.new])))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        (p: { old: { id: string } }) => setMsgs((m) => m.filter((x) => x.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, projectId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length]);

  // Grow the composer with its content, up to ~5 lines.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [body]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text) return;
    const temp = { id: `tmp-${Date.now()}`, project_id: projectId, sender_id: userId, body: text, created_at: new Date().toISOString(), pending: true };
    setMsgs((m) => [...m, temp]);
    setBody("");
    const { data, error } = await supabase.from("messages").insert({ project_id: projectId, sender_id: userId, body: text }).select().single();
    if (error) {
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
      setBody(text);
      return toast(error.message, { kind: "error" });
    }
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m.filter((x) => x.id !== temp.id) : m.map((x) => (x.id === temp.id ? data : x))));
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast(error.message, { kind: "error" });
    else setMsgs((m) => m.filter((x) => x.id !== id));
  };

  const profileOf = (id: string) => members.find((m) => m.user_id === id)?.profile;

  return (
    <div className="card flex h-[calc(100dvh-20rem)] min-h-[380px] flex-col overflow-hidden sm:h-[calc(100dvh-17rem)]">
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-10 w-2/3" /><div className="skeleton ml-auto h-10 w-1/2" /><div className="skeleton h-14 w-3/4" />
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-4xl" aria-hidden>👋</p>
            <p className="mt-2 font-bold">Fresh team, empty chat.</p>
            <p className="mt-1 max-w-xs text-sm text-zinc-600 dark:text-zinc-400">Say hi, share the repo, or pick a time to hack on it this week.</p>
          </div>
        ) : (
          msgs.map((m, i) => {
            const prev = msgs[i - 1];
            const next = msgs[i + 1];
            const mine = m.sender_id === userId;
            const p = profileOf(m.sender_id);
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
            const close = (a?: Message, b?: Message) => !!a && !!b && a.sender_id === b.sender_id && Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60_000 && new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString();
            const first = !close(prev, m);
            const last = !close(m, next);
            const open = openId === m.id;
            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-4 text-center"><span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{dayLabel(m.created_at)}</span></p>
                )}
                <div className={cn("flex items-end gap-2", mine && "flex-row-reverse", first ? "mt-3" : "mt-0.5")}>
                  {!mine && (last ? <Avatar src={p?.avatar_url} name={p?.name ?? ""} size={28} /> : <span className="w-7 shrink-0" aria-hidden />)}
                  <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
                    {first && !mine && <p className="mb-1 ml-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">{p?.name ?? "Former member"}</p>}
                    <button
                      type="button"
                      onClick={() => !m.pending && setOpenId(open ? null : m.id)}
                      className={cn(
                        "whitespace-pre-wrap break-words px-3.5 py-2 text-left text-[15px] leading-snug transition",
                        mine ? "bg-brand text-white" : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
                        "rounded-[20px]",
                        mine ? (last ? "rounded-br-md" : "") : (last ? "rounded-bl-md" : ""),
                        m.pending && "opacity-60",
                        open && "ring-2 ring-lime-300"
                      )}
                      aria-label={`${mine ? "You" : p?.name ?? "Member"}: ${m.body}`}
                    >
                      {m.body}
                    </button>
                    {(last || open) && (
                      <div className={cn("mt-1 flex items-center gap-2 px-1 text-[11px] text-zinc-400", mine && "flex-row-reverse")}>
                        <span>{m.pending ? "Sending…" : clock(m.created_at)}</span>
                        {open && (mine || isOwner) && <button className="font-bold text-red-600" onClick={() => del(m.id)}>Delete</button>}
                        {open && !mine && <ReportButton targetType="message" targetId={m.id} className="font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200" />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-zinc-100 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <label htmlFor="composer" className="sr-only">Message</label>
        <textarea
          id="composer" ref={boxRef} rows={1} value={body} maxLength={4000} placeholder="Message the team"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="input min-h-[48px] resize-none rounded-3xl py-3 leading-snug"
        />
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_3px_0_0_#4c1d95] transition active:translate-y-0.5 active:shadow-none disabled:opacity-40" disabled={!body.trim()} aria-label="Send">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </div>
  );
}

function Tasks({ projectId, members, nameOf }: { projectId: string; members: Member[]; nameOf: (id: string | null) => string }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").eq("project_id", projectId).order("created_at");
    setTasks(data ?? []);
  }, [supabase, projectId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`tasks:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, projectId, load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { data, error } = await supabase.from("tasks").insert({ project_id: projectId, title: title.trim(), assignee_id: assignee || null }).select().single();
    if (error) return toast(error.message, { kind: "error" });
    setTasks((t) => (t.some((x) => x.id === data.id) ? t : [...t, data]));
    setTitle("");
  };

  const update = async (id: string, patch: Partial<Task>) => {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) { toast(error.message, { kind: "error" }); load(); }
  };

  const del = async (id: string) => {
    setTasks((t) => t.filter((x) => x.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast(error.message, { kind: "error" }); load(); }
  };

  const done = tasks.filter((t) => t.done).length;
  const ordered = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)];

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="card p-3">
        <div className="flex gap-2">
          <label htmlFor="task-title" className="sr-only">New task</label>
          <input id="task-title" className="input" placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <button className="btn-primary shrink-0 px-4" disabled={!title.trim()} aria-label="Add task">Add</button>
        </div>
        <label htmlFor="task-assignee" className="sr-only">Assign to</label>
        <select id="task-assignee" className="input mt-2 h-10 rounded-xl text-sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Anyone can grab it</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>For {m.profile?.name || m.profile?.username}</option>)}
        </select>
      </form>

      {tasks.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-3xl" aria-hidden>✅</p>
          <p className="mt-2 font-bold">Nothing on the list yet.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Add the first small win, like &ldquo;Ship the waitlist page&rdquo;.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-1">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={tasks.length} aria-label="Tasks done">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-lime-400 transition-all duration-500" style={{ width: `${(done / tasks.length) * 100}%` }} />
            </div>
            <span className="text-xs font-bold tabular-nums text-zinc-500">{done}/{tasks.length} done</span>
          </div>
          <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {ordered.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-3">
                <button
                  type="button" role="checkbox" aria-checked={t.done} aria-label={`Mark ${t.title} ${t.done ? "not done" : "done"}`}
                  onClick={() => update(t.id, { done: !t.done })}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-inset transition active:scale-90",
                    t.done ? "bg-lime-300 text-zinc-900 ring-lime-400" : "ring-zinc-300 hover:ring-brand dark:ring-zinc-600"
                  )}
                >
                  {t.done && <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("break-words font-medium", t.done && "text-zinc-400 line-through")}>{t.title}</p>
                  <select
                    className="mt-0.5 max-w-full cursor-pointer appearance-none bg-transparent text-xs font-semibold text-zinc-500 hover:text-brand focus:outline-none dark:text-zinc-400"
                    value={t.assignee_id ?? ""} onChange={(e) => update(t.id, { assignee_id: e.target.value || null })} aria-label={`Assignee for ${t.title}`}
                  >
                    <option value="">Unassigned ▾</option>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>@{m.profile?.name || m.profile?.username} ▾</option>)}
                  </select>
                  {t.assignee_id && !members.some((m) => m.user_id === t.assignee_id) && <span className="text-xs text-zinc-500"> {nameOf(t.assignee_id)}</span>}
                </div>
                <button className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800" onClick={() => del(t.id)} aria-label={`Delete ${t.title}`}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function Links({ projectId, userId, isOwner, nameOf }: { projectId: string; userId: string; isOwner: boolean; nameOf: (id: string | null) => string }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [form, setForm] = useState({ title: "", url: "", note: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase.from("project_links").select("*").eq("project_id", projectId).order("created_at", { ascending: false })
      .then(({ data }: { data: LinkRow[] | null }) => setLinks(data ?? []));
  }, [supabase, projectId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    let url = form.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    const { data, error } = await supabase.from("project_links")
      .insert({ project_id: projectId, author_id: userId, title: form.title.trim(), url: url || null, note: form.note.trim() || null })
      .select().single();
    if (error) return toast(error.message, { kind: "error" });
    setLinks((l) => [data, ...l]);
    setForm({ title: "", url: "", note: "" });
    setAdding(false);
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("project_links").delete().eq("id", id);
    if (error) toast(error.message, { kind: "error" });
    else setLinks((l) => l.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      {adding ? (
        <form onSubmit={add} className="card space-y-4 p-4">
          <Field label="Title" htmlFor="link-title" required>
            <input id="link-title" className="input" placeholder="Figma file, repo, launch plan" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </Field>
          <Field label="Link" htmlFor="link-url" optional>
            <input id="link-url" className="input" inputMode="url" placeholder="github.com/you/repo" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          <Field label="Note" htmlFor="link-note" optional>
            <textarea id="link-note" className="input" rows={3} placeholder="Anything the team should know" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary flex-[2]" disabled={!form.title.trim()}>Save</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 text-sm font-bold text-zinc-600 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-400">
          <span aria-hidden className="text-lg">＋</span> Add a link or note
        </button>
      )}
      {links.length === 0 ? (
        !adding && (
          <div className="card p-8 text-center">
            <p className="text-3xl" aria-hidden>📎</p>
            <p className="mt-2 font-bold">Your shared drawer is empty.</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Drop the repo, the Figma and that one Notion doc here.</p>
          </div>
        )
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.id} className="card flex gap-3 p-4">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-lg dark:bg-violet-950/60">{l.url ? "🔗" : "📝"}</span>
              <div className="min-w-0 flex-1">
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:text-brand">{l.title} <span aria-hidden className="text-zinc-400">↗</span></a>
                ) : (
                  <p className="font-bold">{l.title}</p>
                )}
                {l.url && <p className="truncate text-xs font-medium text-brand dark:text-violet-300">{hostOf(l.url)}</p>}
                {l.note && <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{l.note}</p>}
                <p className="mt-2 text-[11px] text-zinc-400">{nameOf(l.author_id)} · {timeAgo(l.created_at)}</p>
              </div>
              {(l.author_id === userId || isOwner) && (
                <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800" onClick={() => del(l.id)} aria-label={`Delete ${l.title}`}>✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
