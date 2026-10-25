"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Form";
import { EmptyState, SectionTitle, TabBar } from "./ui";
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

  const needs = list.filter((r) => r.status === "pending" || r.status === "interested");
  const rest = list.filter((r) => !(r.status === "pending" || r.status === "interested"));

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Your matches" title="Inbox" description="Requests, invites and matches across every event, live." />
      <TabBar
        label="Inbox"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "received", label: "Received", count: all ? (newCount || null) : null },
          { value: "sent", label: "Sent", count: all ? (sent.length || null) : null },
        ]}
      />
      {all === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState
          emoji={tab === "received" ? "📭" : "✋"}
          title={tab === "received" ? "Quiet in here, for now" : "You haven't counted yourself in yet"}
          body={tab === "received" ? "Requests to your projects and invites to you land here in real time." : "Find a project at an event and tap “Count me in”."}
          action={<Link href="/" className="btn-secondary">Find an event</Link>}
        />
      ) : (
        <div key={tab} className="animate-rise space-y-6">
          {needs.length > 0 && (
            <section>
              <SectionTitle>{tab === "received" ? "Waiting on you" : "In progress"}</SectionTitle>
              <div className="space-y-3">{needs.map((r) => <RequestCard key={r.id} r={r} viewerId={userId} onChanged={onChanged} />)}</div>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <SectionTitle>Earlier</SectionTitle>
              <div className="space-y-3">{rest.map((r) => <RequestCard key={r.id} r={r} viewerId={userId} onChanged={onChanged} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
