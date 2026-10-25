"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { fmtDate, timeAgo } from "@/lib/utils";

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
  };

  const setBan = async (u: U, banned: boolean) => {
    const { error } = await supabase.from("profiles").update({ banned }).eq("id", u.id);
    if (error) return toast(error.message, { kind: "error" });
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, banned } : x)));
  };

  const delEvent = async (ev: Ev) => {
    if (!confirm(`Delete event "${ev.name}"?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) return toast(error.message, { kind: "error" });
    setEvents((es) => es.filter((x) => x.id !== ev.id));
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin</h1>

      <section>
        <h2 className="mb-2 font-semibold">Open reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="muted text-sm">All clear 🎉</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="card space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="chip bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200">{r.target_type}</span>
                  <span className="muted text-xs">by @{r.reporter?.username ?? "?"} · {timeAgo(r.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.reason}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => open(r)}>View</button>
                  <button className="btn-ghost" onClick={() => resolve(r, "dismissed")}>Dismiss</button>
                  <button className="btn-danger" onClick={() => resolve(r, "actioned")}>{r.target_type === "profile" ? "Ban user" : "Delete"}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Users</h2>
        <form onSubmit={search} className="flex gap-2">
          <input className="input" placeholder="Search name or username" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
          <button className="btn-primary">Search</button>
        </form>
        {users.length > 0 && (
          <ul className="card mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 p-3">
                <Avatar src={u.avatar_url} name={u.name} size={32} />
                <Link href={`/u/${u.username}`} className="min-w-0 flex-1 truncate hover:underline">{u.name || u.username} <span className="muted">@{u.username}</span></Link>
                {u.banned
                  ? <button className="btn-secondary" onClick={() => setBan(u, false)}>Unban</button>
                  : <button className="btn-danger" onClick={() => setBan(u, true)}>Ban</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Recent events</h2>
        <ul className="card divide-y divide-zinc-200 dark:divide-zinc-800">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <Link href={`/organizer/${ev.id}`} className="font-medium hover:underline">{ev.name}</Link>
                <p className="muted text-xs">{ev.code} · {fmtDate(ev.starts_at)} · {ev.visibility} · @{ev.organizer?.username}</p>
              </div>
              <button className="btn-ghost text-red-600" onClick={() => delEvent(ev)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
