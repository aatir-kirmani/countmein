"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { ReportButton } from "@/components/ReportButton";
import { Empty } from "@/components/ui/Empty";
import { cn, timeAgo } from "@/lib/utils";
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
    setMembers(rows);
    const entries = await Promise.all(
      rows.map(async (m) => {
        const { data: c } = await supabase.rpc("get_contact", { p_user: m.user_id });
        return [m.user_id, (c?.[0] ?? { contact_email: null, contact_phone: null }) as Contact] as const;
      })
    );
    setContacts(Object.fromEntries(entries));
  }, [supabase, project.id]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {project.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-xl font-bold dark:bg-zinc-800">{project.name[0]}</span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{project.name}</h1>
          <Link href={`/p/${project.id}`} className="muted text-sm underline">Project page</Link>
        </div>
      </div>

      <div role="tablist" className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("min-h-[40px] rounded-lg text-sm font-medium", tab === t ? "bg-white shadow dark:bg-zinc-800" : "muted")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Chat" && <Chat projectId={project.id} userId={userId} isOwner={isOwner} members={members} />}

      {tab === "Members" && (
        <ul className="space-y-2">
          {members.map((m) => {
            const c = contacts[m.user_id];
            const isMe = m.user_id === userId;
            const isFounder = m.user_id === project.owner_id;
            return (
              <li key={m.user_id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={m.profile?.avatar_url} name={m.profile?.name ?? ""} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/u/${m.profile?.username}`} className="font-semibold hover:underline">{m.profile?.name || m.profile?.username}{isMe && " (you)"}</Link>
                    {isOwner && !isFounder ? (
                      <input className="input mt-1 min-h-[36px] text-sm" defaultValue={m.role} aria-label="Role"
                        onBlur={(e) => e.target.value.trim() && e.target.value !== m.role && changeRole(m.user_id, e.target.value.trim())} />
                    ) : (
                      <p className="muted text-sm">{m.role}</p>
                    )}
                  </div>
                </div>
                {c && (c.contact_email || c.contact_phone) && !isMe && (
                  <div className="mt-3 space-y-1 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
                    {c.contact_email && <p>✉ <a className="underline" href={`mailto:${c.contact_email}`}>{c.contact_email}</a></p>}
                    {c.contact_phone && <p>☎ <a className="underline" href={`tel:${c.contact_phone}`}>{c.contact_phone}</a></p>}
                  </div>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  {isOwner && !isFounder && <button className="btn-ghost text-sm text-red-600" onClick={() => removeMember(m.user_id)}>Remove</button>}
                  {isMe && !isOwner && <button className="btn-ghost text-sm text-red-600" onClick={() => removeMember(m.user_id, true)}>Leave project</button>}
                </div>
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

function Chat({ projectId, userId, isOwner, members }: { projectId: string; userId: string; isOwner: boolean; members: Member[] }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [msgs, setMsgs] = useState<(Message & { pending?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="card flex h-[65dvh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-2/3" />)}</div>
        ) : msgs.length === 0 ? (
          <p className="muted py-10 text-center text-sm">No messages yet. Say hi 👋</p>
        ) : (
          msgs.map((m) => {
            const mine = m.sender_id === userId;
            const p = profileOf(m.sender_id);
            return (
              <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
                {!mine && <Avatar src={p?.avatar_url} name={p?.name ?? ""} size={32} />}
                <div className={cn("max-w-[80%]", mine && "text-right")}>
                  <p className="muted text-xs">{mine ? "You" : p?.name ?? "Former member"} · {timeAgo(m.created_at)}</p>
                  <p className={cn("inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm", mine ? "bg-brand text-white" : "bg-zinc-100 dark:bg-zinc-800", m.pending && "opacity-60")}>{m.body}</p>
                  {!m.pending && (
                    <div className={cn("flex gap-1", mine && "justify-end")}>
                      {(mine || isOwner) && <button className="btn-ghost min-h-0 px-2 py-1 text-xs" onClick={() => del(m.id)}>Delete</button>}
                      {!mine && <ReportButton targetType="message" targetId={m.id} className="btn-ghost min-h-0 px-2 py-1 text-xs" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <input className="input" placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} aria-label="Message" />
        <button className="btn-primary" disabled={!body.trim()}>Send</button>
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

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="card space-y-2 p-4">
        <input className="input" placeholder="New task" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Task title" />
        <div className="flex gap-2">
          <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee">
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.name || m.profile?.username}</option>)}
          </select>
          <button className="btn-primary" disabled={!title.trim()}>Add</button>
        </div>
      </form>
      {tasks.length === 0 ? (
        <Empty title="No tasks yet" body="Add the first thing to get done together." />
      ) : (
        <ul className="card divide-y divide-zinc-200 dark:divide-zinc-800">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-3">
              <input type="checkbox" className="h-6 w-6 accent-violet-700" checked={t.done} onChange={(e) => update(t.id, { done: e.target.checked })} aria-label={`Mark ${t.title} done`} />
              <div className="min-w-0 flex-1">
                <p className={cn("break-words", t.done && "muted line-through")}>{t.title}</p>
                <select className="muted bg-transparent text-xs" value={t.assignee_id ?? ""} onChange={(e) => update(t.id, { assignee_id: e.target.value || null })} aria-label="Assignee">
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.name || m.profile?.username}</option>)}
                </select>
                {t.assignee_id && !members.some((m) => m.user_id === t.assignee_id) && <span className="muted text-xs"> {nameOf(t.assignee_id)}</span>}
              </div>
              <button className="btn-ghost px-3 text-sm" onClick={() => del(t.id)} aria-label="Delete task">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Links({ projectId, userId, isOwner, nameOf }: { projectId: string; userId: string; isOwner: boolean; nameOf: (id: string | null) => string }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [form, setForm] = useState({ title: "", url: "", note: "" });

  useEffect(() => {
    supabase.from("project_links").select("*").eq("project_id", projectId).order("created_at", { ascending: false })
      .then(({ data }: { data: LinkRow[] | null }) => setLinks(data ?? []));
  }, [supabase, projectId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const { data, error } = await supabase.from("project_links")
      .insert({ project_id: projectId, author_id: userId, title: form.title.trim(), url: form.url.trim() || null, note: form.note.trim() || null })
      .select().single();
    if (error) return toast(error.message, { kind: "error" });
    setLinks((l) => [data, ...l]);
    setForm({ title: "", url: "", note: "" });
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("project_links").delete().eq("id", id);
    if (error) toast(error.message, { kind: "error" });
    else setLinks((l) => l.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="card space-y-2 p-4">
        <input className="input" placeholder="Title (e.g. Figma file, repo, notes)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Title" />
        <input className="input" type="url" placeholder="https://… (optional)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} aria-label="URL" />
        <textarea className="input" rows={2} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-label="Note" />
        <button className="btn-primary w-full" disabled={!form.title.trim()}>Add</button>
      </form>
      {links.length === 0 ? (
        <Empty title="No shared links or notes yet" />
      ) : (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{l.title}</a> : <p className="font-semibold">{l.title}</p>}
                  {l.note && <p className="mt-1 whitespace-pre-wrap text-sm">{l.note}</p>}
                  <p className="muted mt-1 text-xs">{nameOf(l.author_id)} · {timeAgo(l.created_at)}</p>
                </div>
                {(l.author_id === userId || isOwner) && <button className="btn-ghost px-3 text-sm" onClick={() => del(l.id)} aria-label="Delete">✕</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
