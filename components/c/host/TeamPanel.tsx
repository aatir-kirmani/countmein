"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";
import { Avatar } from "@/components/ui/Avatar";
import { FormSection, Segmented } from "@/components/ui/Form";
import { cn } from "@/lib/utils";
import type { EventHost, EventRow } from "@/lib/types";
import type { GuestProfile } from "./core";
import { HIcon } from "./ui";

export type HostRow = EventHost & { profile: Pick<GuestProfile, "id" | "name" | "username" | "avatar_url"> | null };
type Role = EventHost["role"];

const ROLES: { value: Role; label: string }[] = [
  { value: "cohost", label: "Co-host" },
  { value: "manager", label: "Manager" },
];
const ROLE_HINT: Record<Role, string> = {
  cohost: "Co-hosts run the event with you and can appear on the event page.",
  manager: "Managers help behind the scenes: guests, check-in, messages.",
};

export function TeamPanel({ event, userId, isOwner, owner, initial }: {
  event: EventRow; userId: string; isOwner: boolean;
  owner: Pick<GuestProfile, "id" | "name" | "username" | "avatar_url"> | null; initial: HostRow[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const [hosts, setHosts] = useState(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<HostRow["profile"][]>([]);
  const [role, setRole] = useState<Role>("cohost");
  const [busy, setBusy] = useState(false);

  // Search people to add, debounced.
  useEffect(() => {
    const term = q.replace(/[^\p{L}\p{N}_ .-]/gu, "").trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id,name,username,avatar_url")
        .or(`username.ilike.%${term}%,name.ilike.%${term}%`).limit(8);
      const taken = new Set([event.organizer_id, ...hosts.map((h) => h.user_id)]);
      setResults(((data ?? []) as HostRow["profile"][]).filter((p) => p && !taken.has(p.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, hosts, event.organizer_id, supabase]);

  const add = async (p: NonNullable<HostRow["profile"]>) => {
    setBusy(true);
    const { error } = await supabase.from("event_hosts").insert({ event_id: event.id, user_id: p.id, role, show_on_page: role === "cohost", added_by: userId });
    setBusy(false);
    if (error) return toast(error.message, { kind: "error" });
    setHosts((h) => [...h, { event_id: event.id, user_id: p.id, role, show_on_page: role === "cohost", created_at: new Date().toISOString(), profile: p }]);
    setQ(""); setResults([]);
    toast(`${p.name || p.username} added as ${role === "cohost" ? "a co-host" : "a manager"}`, { kind: "success" });
  };

  const update = async (h: HostRow, patch: Partial<Pick<EventHost, "role" | "show_on_page">>) => {
    setHosts((all) => all.map((x) => (x.user_id === h.user_id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("event_hosts").update(patch).eq("event_id", event.id).eq("user_id", h.user_id);
    if (error) { toast(error.message, { kind: "error" }); setHosts((all) => all.map((x) => (x.user_id === h.user_id ? h : x))); }
  };

  const remove = async (h: HostRow) => {
    const self = h.user_id === userId;
    if (!confirm(self ? "Leave the host team for this event?" : `Remove ${h.profile?.name || "this person"} from the team?`)) return;
    const { error } = await supabase.from("event_hosts").delete().eq("event_id", event.id).eq("user_id", h.user_id);
    if (error) return toast(error.message, { kind: "error" });
    if (self) { toast("You left the team"); router.push("/organizer"); return; }
    setHosts((all) => all.filter((x) => x.user_id !== h.user_id));
  };

  return (
    <div className="space-y-5">
      <FormSection title="Host team" description="Bring friends in to approve guests, scan tickets at the door and send updates.">
        <ul className="-mx-1 divide-y divide-zinc-100 dark:divide-zinc-800">
          {owner && (
            <li className="flex items-center gap-3 px-1 py-3">
              <Avatar src={owner.avatar_url} name={owner.name} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{owner.name || owner.username}{owner.id === userId && <span className="font-normal text-zinc-500"> (you)</span>}</p>
                <p className="text-xs text-zinc-500">Created the event. Full control.</p>
              </div>
              <span className="chip bg-brand text-white">Owner</span>
            </li>
          )}
          {hosts.map((h) => (
            <li key={h.user_id} className="flex flex-wrap items-center gap-3 px-1 py-3">
              <Avatar src={h.profile?.avatar_url} name={h.profile?.name ?? ""} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{h.profile?.name || h.profile?.username}{h.user_id === userId && <span className="font-normal text-zinc-500"> (you)</span>}</p>
                <p className="text-xs text-zinc-500">@{h.profile?.username}{h.show_on_page ? " · shown on event page" : " · hidden from event page"}</p>
              </div>
              {isOwner ? (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <select
                    className="input h-10 w-auto flex-1 py-0 text-sm sm:flex-none" value={h.role} aria-label={`Role for ${h.profile?.name}`}
                    onChange={(e) => update(h, { role: e.target.value as Role })}
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button
                    type="button" onClick={() => update(h, { show_on_page: !h.show_on_page })} aria-pressed={h.show_on_page}
                    className={cn("btn-sm btn", h.show_on_page ? "bg-violet-50 text-brand ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900" : "btn-secondary")}
                    title="Show on event page"
                  >
                    <HIcon name="eye" className="h-4 w-4" /><span className="sr-only sm:not-sr-only">{h.show_on_page ? "Shown" : "Hidden"}</span>
                  </button>
                  <button className="btn-ghost btn-sm text-red-600" onClick={() => remove(h)}>Remove</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="chip bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{h.role === "cohost" ? "Co-host" : "Manager"}</span>
                  {h.user_id === userId && <button className="btn-ghost btn-sm text-red-600" onClick={() => remove(h)}>Leave</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
        {hosts.length === 0 && <p className="text-sm text-zinc-500">It&apos;s just you for now.</p>}
      </FormSection>

      {isOwner ? (
        <FormSection title="Add someone" description="They need a Countmein account. Search by name or username.">
          <Segmented label="Role" options={ROLES} value={role} onChange={setRole} />
          <p className="-mt-2 text-xs text-zinc-500">{ROLE_HINT[role]}</p>
          <label className="relative block">
            <span className="sr-only">Search people</span>
            <HIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input className="input pl-10" placeholder="Search name or @username" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </label>
          {q.trim().length >= 2 && (
            <ul className="space-y-1.5">
              {results.length === 0 && <li className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-900/60">No one found. Ask them to sign up first, then search again.</li>}
              {results.map((p) => p && (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800">
                  <Avatar src={p.avatar_url} name={p.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name || p.username}</p>
                    <p className="truncate text-xs text-zinc-500">@{p.username}</p>
                  </div>
                  <button className="btn-primary btn-sm" disabled={busy} onClick={() => add(p)}>Add</button>
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      ) : (
        <p className="rounded-3xl bg-zinc-50 p-5 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-400 dark:ring-zinc-800">
          Only the owner can add or remove people from the team.
        </p>
      )}
    </div>
  );
}
