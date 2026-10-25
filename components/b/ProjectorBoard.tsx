"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import type { EventRow } from "@/lib/types";
import { openSlots, siteUrl, stageLabel } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useEventData } from "./useEventData";

type Celebration = { id: string; who: string; avatar: string | null; project: string; role: string };

export function ProjectorBoard({ event, sponsors }: { event: EventRow; sponsors: { id: string; name: string; logo_url: string | null }[] }) {
  const supabase = createClient();
  const { projects, people } = useEventData(event.id, true);
  const [qr, setQr] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [queue, setQueue] = useState<Celebration[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const url = `${siteUrl()}/e/${event.code}`;

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#000000", light: "#ffffff" } }).then(setQr);
  }, [url]);

  // Match feed: count + celebration queue.
  useEffect(() => {
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("event_id", event.id)
      .then(({ count }: { count: number | null }) => setMatchCount(count ?? 0));
    const ch = supabase.channel(`matches:${event.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter: `event_id=eq.${event.id}` },
        async (payload: { new: { id: string; user_id: string; project_id: string; role: string } }) => {
          const m = payload.new;
          setMatchCount((c) => c + 1);
          const [{ data: u }, { data: p }] = await Promise.all([
            supabase.from("profiles").select("name,avatar_url").eq("id", m.user_id).single(),
            supabase.from("projects").select("name").eq("id", m.project_id).single(),
          ]);
          setQueue((q) => [...q, { id: m.id, who: u?.name || "Someone", avatar: u?.avatar_url ?? null, project: p?.name || "a project", role: m.role }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, event.id]);

  // Show each celebration for 5s.
  useEffect(() => {
    if (!queue.length) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 5000);
    return () => clearTimeout(t);
  }, [queue]);

  // Slow auto-scroll loop.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let pause = 0;
    const id = setInterval(() => {
      if (pause > 0) { pause--; return; }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) { pause = 60; el.scrollTo({ top: 0, behavior: "smooth" }); }
      else el.scrollTop += 1;
    }, 40);
    return () => clearInterval(id);
  }, []);

  const current = queue[0];

  return (
    <div className="dark fixed inset-0 flex flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between gap-6 border-b border-zinc-800 px-8 py-5">
        <div className="min-w-0">
          <p className="text-lg font-bold text-violet-400">Count<span className="text-white">me</span>in · Live Board</p>
          <h1 className="truncate text-4xl font-extrabold tracking-tight">{event.name}</h1>
        </div>
        <div className="flex shrink-0 gap-8 text-center">
          <Stat n={people?.length ?? 0} label="here now" />
          <Stat n={projects?.length ?? 0} label="projects" />
          <Stat n={matchCount} label="matches" />
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-hidden px-8 py-6 pr-[300px]">
        {projects && projects.length === 0 && (
          <p className="mt-24 text-center text-3xl font-semibold text-zinc-400">No projects yet. Scan the code and be the first!</p>
        )}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {(projects ?? []).map((p) => {
            const slots = openSlots(p);
            return (
              <article key={p.id} className="rounded-3xl bg-zinc-900 p-6 ring-1 ring-zinc-800">
                <div className="flex items-start gap-4">
                  {p.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-3xl font-bold">{p.name[0]}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-2xl font-bold">{p.name}</h2>
                    <p className="line-clamp-2 text-lg text-zinc-300">{p.pitch}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-base">
                  <span className="flex items-center gap-2 text-zinc-300"><Avatar src={p.owner?.avatar_url} name={p.owner?.name ?? ""} size={28} />{p.owner?.name}</span>
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">{stageLabel(p.stage)}</span>
                  {p.openness === "anyone" && <span className="rounded-full bg-emerald-700 px-3 py-1 text-sm font-semibold">Open to anyone</span>}
                  {slots.length > 0 && <span className="rounded-full bg-violet-700 px-3 py-1 text-sm font-semibold">Needs: {slots.map((s) => s.specialty).join(", ")}</span>}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="fixed bottom-6 right-6 w-[260px] rounded-3xl bg-white p-4 text-center text-zinc-900 shadow-2xl">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code to join ${event.name}`} className="mx-auto w-full" />
        )}
        <p className="mt-2 text-sm font-medium">Scan or enter code</p>
        <p className="font-mono text-4xl font-extrabold tracking-widest">{event.code}</p>
      </aside>

      {sponsors.length > 0 && (
        <footer className="flex items-center gap-6 border-t border-zinc-800 px-8 py-3 pr-[300px] text-zinc-400">
          <span className="text-sm uppercase tracking-wide">Thanks to</span>
          {sponsors.map((s) => (
            <span key={s.id} className="flex items-center gap-2 text-lg font-semibold text-zinc-200">
              {s.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="" className="h-7 w-7 rounded object-contain" />
              )}
              {s.name}
            </span>
          ))}
        </footer>
      )}

      {current && (
        <div key={current.id} role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/90 backdrop-blur">
          <div className="animate-pop text-center">
            <p className="text-7xl" aria-hidden>🎉</p>
            <div className="mt-6 flex justify-center"><Avatar src={current.avatar} name={current.who} size={140} /></div>
            <p className="mt-6 text-6xl font-extrabold leading-tight">
              {current.who} joined <span className="text-violet-300">{current.project}</span>
            </p>
            <p className="mt-3 text-4xl font-semibold text-violet-200">as {current.role}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="text-5xl font-extrabold tabular-nums">{n}</p>
      <p className="text-sm uppercase tracking-wide text-zinc-400">{label}</p>
    </div>
  );
}
