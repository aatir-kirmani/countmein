"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty } from "@/components/ui/Empty";
import { cn } from "@/lib/utils";
import { REQUEST_SELECT, RequestCard, type FullRequest } from "./RequestCard";

export function InboxView({ userId }: { userId: string }) {
  const supabase = createClient();
  const [all, setAll] = useState<FullRequest[] | null>(null);
  const [tab, setTab] = useState<"received" | "sent">("received");

  const load = useCallback(async () => {
    const { data: mine } = await supabase.from("projects").select("id").eq("owner_id", userId);
    const ids = (mine ?? []).map((p: { id: string }) => p.id);
    const [{ data: asCand }, { data: asOwner }] = await Promise.all([
      supabase.from("join_requests").select(REQUEST_SELECT).eq("requester_id", userId).order("created_at", { ascending: false }).limit(200),
      ids.length
        ? supabase.from("join_requests").select(REQUEST_SELECT).in("project_id", ids).order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] }),
    ]);
    const map = new Map<string, FullRequest>();
    [...(asCand ?? []), ...(asOwner ?? [])].forEach((r: FullRequest) => map.set(r.id, r));
    setAll([...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }, [supabase, userId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`inbox:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, userId, load]);

  // Received = requests to my projects + invites to me. Sent = my requests + my invites.
  const { received, sent } = useMemo(() => {
    const rec: FullRequest[] = [];
    const snt: FullRequest[] = [];
    (all ?? []).forEach((r) => {
      const iOwn = r.project?.owner_id === userId;
      const incoming = (r.direction === "request" && iOwn) || (r.direction === "invite" && r.requester_id === userId);
      (incoming ? rec : snt).push(r);
    });
    const rank = (s: string) => (s === "pending" ? 0 : s === "interested" ? 1 : 2);
    rec.sort((a, b) => rank(a.status) - rank(b.status));
    return { received: rec, sent: snt };
  }, [all, userId]);

  const list = tab === "received" ? received : sent;
  const newCount = received.filter((r) => r.status === "pending").length;

  const onChanged = (id: string, status: FullRequest["status"]) => setAll((rs) => rs?.map((r) => (r.id === id ? { ...r, status } : r)) ?? rs);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Inbox</h1>
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-zinc-200 p-1 dark:bg-zinc-800">
        {(["received", "sent"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("min-h-[40px] rounded-lg text-sm font-semibold capitalize", tab === t ? "bg-white shadow dark:bg-zinc-950" : "muted")}>
            {t}{t === "received" && newCount > 0 ? ` (${newCount})` : ""}
          </button>
        ))}
      </div>
      {all === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      ) : list.length === 0 ? (
        <Empty
          title={tab === "received" ? "Nothing received yet" : "You haven't sent anything yet"}
          body={tab === "received" ? "Requests to your projects and invites to you show up here in real time." : "Find a project at an event and tap “Count me in”."}
        />
      ) : (
        <div className="space-y-3">{list.map((r) => <RequestCard key={r.id} r={r} viewerId={userId} onChanged={onChanged} />)}</div>
      )}
    </div>
  );
}
