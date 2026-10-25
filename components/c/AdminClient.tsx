"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { cn, fmtDate, timeAgo } from "@/lib/utils";
import { PageHeader } from "@/components/ui/Form";

type Report = { id: string; target_type: "project" | "profile" | "message" | "event"; target_id: string; reason: string; created_at: string; reporter: { name: string; username: string } | null };
type Ev = { id: string; name: string; code: string; starts_at: string; visibility: string; organizer: { name: string; username: string } | null };
type U = { id: string; name: string; username: string; avatar_url: string | null; banned: boolean };

const TABLE = { project: "projects", message: "messages", event: "events" } as const;

export function AdminClient({ reports: initialReports, events: initialEvents }: { reports: Report[]; events: Ev[] }) {
  const supabase = createClient();
  const { toast } = useApp();
  const [reports, setReports] = useState(initialReports);
  const [events, setEvents] = useState(initialEvents);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<U[]>([]);
  const [searched, setSearched] = useState(false);
  const [tab, setTab] = useState<"reports" | "users" | "events">("reports");

  const resolve = async (r: Report, status: "dismissed" | "actioned") => {
    if (status === "actioned") {
      const label = r.target_type === "profile" ? "Ban this user?" : `Delete this ${r.target_type}?`;
      if (!confirm(label)) return;
      const { error } = r.target_type === "profile"
        ? await supabase.from("profiles").update({ banned: true }).eq("id", r.target_id)
        : await supabase.from(TABLE[r.target_type]).delete().eq("id", r.target_id);
      if (error) return toast(error.message, { kind: "error" });
    }
    const { error } = await supabase.from("reports").update({ status }).eq("id", r.id);
    if (error) return toast(error.message, { kind: "error" });
    setReports((rs) => rs.filter((x) => x.id !== r.id));
    toast(status === "actioned" ? "Action taken" : "Dismissed");
  };

  const targetHref = async (r: Report) => {
    if (r.target_type === "project") return `/p/${r.target_id}`;
    if (r.target_type === "profile") {
      const { data } = await supabase.from("profiles").select("username").eq("id", r.target_id).single();
      return data ? `/u/${data.username}` : null;
    }
    if (r.target_type === "event") {
      const { data } = await supabase.from("events").select("code").eq("id", r.target_id).single();
      return data ? `/e/${data.code}` : null;
    }
    const { data } = await supabase.from("messages").select("body, project_id").eq("id", r.target_id).single();
    if (data) alert(`Message:\n\n${data.body}`);
    return null;
  };

  const open = async (r: Report) => {
    const href = await targetHref(r);
    if (href) window.open(href, "_blank");
    else if (r.target_type !== "message") toast("Target no longer exists");
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim().replace(/[%,()]/g, "");
    if (!term) return;
    const { data, error } = await supabase.from("profiles").select("id,name,username,avatar_url,banned")
      .or(`username.ilike.%${term}%,name.ilike.%${term}%`).limit(25);
    if (error) toast(error.message, { kind: "error" });
    setUsers(data ?? []);
    setSearched(true);
  };

  const setBan = async (u: U, banned: boolean) => {
    const { error } = await supabase.from("profiles").update({ banned }).eq("id", u.id);
    if (error) return toast(error.message, { kind: "error" });
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, banned } : x)));
    toast(banned ? `@${u.username} is banned` : `@${u.username} is unbanned`);
  };

  const delEvent = async (ev: Ev) => {
    if (!confirm(`Delete event "${ev.name}"?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) return toast(error.message, { kind: "error" });
    setEvents((es) => es.filter((x) => x.id !== ev.id));
  };

  const TYPE_STYLE: Record<Report["target_type"], string> = {
    project: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
    profile: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    message: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    event: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  };
  const tabs = [
    { key: "reports", label: "Reports", count: reports.length },
    { key: "users", label: "Users", count: null },
    { key: "events", label: "Events", count: events.length },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Keep it friendly" description="Review reports, ban bad actors and clean up events. Every destructive action asks first." />

      <div role="tablist" aria-label="Admin sections" className="flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {tabs.map((t) => (
          <button
            key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn(
              "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition",
              tab === t.key ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
            )}
          >
            {t.label}
            {t.count ? <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", t.key === "reports" ? "bg-red-500 text-white" : "bg-zinc-200 dark:bg-zinc-600")}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <section aria-label="Open reports">
          {reports.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-4xl" aria-hidden>🕊️</p>
              <p className="mt-2 font-bold">Inbox zero. The community is behaving.</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">New reports land here the moment someone files one.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {reports.map((r) => (
                <li key={r.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("chip capitalize", TYPE_STYLE[r.target_type])}>{r.target_type}</span>
                    <span className="text-xs text-zinc-500">@{r.reporter?.username ?? "unknown"} · {timeAgo(r.created_at)}</span>
                  </div>
                  <blockquote className="mt-3 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 text-sm italic text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">&ldquo;{r.reason}&rdquo;</blockquote>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-secondary btn-sm" onClick={() => open(r)}>{r.target_type === "message" ? "Read message" : "View"}</button>
                    <button className="btn-ghost btn-sm" onClick={() => resolve(r, "dismissed")}>Dismiss</button>
                    <button className="btn-danger btn-sm ml-auto" onClick={() => resolve(r, "actioned")}>{r.target_type === "profile" ? "Ban user" : `Delete ${r.target_type}`}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "users" && (
        <section aria-label="Users" className="space-y-3">
          <form onSubmit={search} className="flex gap-2">
            <label htmlFor="admin-q" className="sr-only">Search users</label>
            <input id="admin-q" className="input" type="search" placeholder="Search by name or username" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn-primary shrink-0">Search</button>
          </form>
          {users.length > 0 ? (
            <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 p-3">
                  <Avatar src={u.avatar_url} name={u.name} size={40} />
                  <Link href={`/u/${u.username}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold hover:text-brand">{u.name || u.username}</span>
                    <span className="block truncate text-xs text-zinc-500">@{u.username}</span>
                  </Link>
                  {u.banned && <span className="chip bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">Banned</span>}
                  {u.banned
                    ? <button className="btn-secondary btn-sm" onClick={() => setBan(u, false)}>Unban</button>
                    : <button className="btn-danger btn-sm" onClick={() => confirm(`Ban @${u.username}? They won't be able to post or request.`) && setBan(u, true)}>Ban</button>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm text-zinc-500">{searched ? "Nobody matches that search." : "Search to find someone by name or @username."}</p>
          )}
        </section>
      )}

      {tab === "events" && (
        <section aria-label="Recent events">
          {events.length === 0 ? (
            <div className="card p-10 text-center text-sm text-zinc-500">No events yet.</div>
          ) : (
            <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 p-3">
                  <span className="hidden shrink-0 rounded-lg bg-zinc-100 px-2 py-1 font-mono text-xs font-bold tracking-widest sm:inline dark:bg-zinc-800">{ev.code}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/organizer/${ev.id}`} className="block truncate font-semibold hover:text-brand">{ev.name}</Link>
                    <p className="truncate text-xs text-zinc-500">{fmtDate(ev.starts_at)} · {ev.visibility.replace("_", " ")} · @{ev.organizer?.username}</p>
                  </div>
                  <button className="btn-ghost btn-sm text-red-600" onClick={() => delEvent(ev)}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
