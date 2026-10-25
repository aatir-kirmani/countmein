"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import type { EventRow } from "@/lib/types";
import { openSlots, siteUrl, stageLabel } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useEventData } from "./useEventData";
import { Confetti } from "./Confetti";
import { hueFor } from "./ui";

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
    <div className="dark fixed inset-0 flex flex-col overflow-hidden bg-zinc-950 text-white">
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-700/30 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 right-40 h-[420px] w-[420px] rounded-full bg-lime-400/10 blur-[120px]" />
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 text-white/[0.04]" />

      <header className="relative flex items-end justify-between gap-8 px-10 pb-6 pt-8">
        <div className="min-w-0">
          <p className="flex items-center gap-3 font-display text-xl font-extrabold">
            <span>Count<span className="text-violet-400">me</span>in<span className="text-lime-300">✦</span></span>
            <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-black uppercase tracking-wider">
              <span className="h-2 w-2 animate-ping rounded-full bg-white" /> Live
            </span>
          </p>
          <h1 className="mt-2 truncate font-display text-6xl font-extrabold leading-none tracking-tight">{event.name}</h1>
        </div>
        <div className="flex shrink-0 gap-3">
          <Stat n={people?.length ?? 0} label="in the room" accent="text-white" />
          <Stat n={projects?.length ?? 0} label="projects" accent="text-violet-300" />
          <Stat n={matchCount} label="matches" accent="text-lime-300" />
        </div>
      </header>

      <div ref={scroller} className="relative flex-1 overflow-hidden px-10 pb-8 pr-[340px]">
        {projects && projects.length === 0 && (
          <div className="mt-20 text-center">
            <p className="text-8xl" aria-hidden>🌱</p>
            <p className="mt-6 font-display text-5xl font-extrabold">The board is wide open.</p>
            <p className="mt-3 text-2xl text-zinc-400">Scan the code and be the first project up.</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {(projects ?? []).map((p) => {
            const slots = openSlots(p);
            return (
              <article key={p.id} className="rounded-[2rem] bg-zinc-900/80 p-7 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-start gap-5">
                  {p.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo_url} alt="" className="h-20 w-20 rounded-3xl object-cover" />
                  ) : (
                    <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl font-display text-4xl font-extrabold ${hueFor(p.name)}`}>{p.name[0]}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-3xl font-extrabold leading-tight">{p.name}</h2>
                    <p className="mt-1 line-clamp-2 text-xl leading-snug text-zinc-300">{p.pitch}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2.5 text-base">
                  <span className="flex items-center gap-2 text-zinc-300"><Avatar src={p.owner?.avatar_url} name={p.owner?.name ?? ""} size={32} />{p.owner?.name}</span>
                  <span className="rounded-full bg-white/10 px-3.5 py-1 text-sm font-semibold">{stageLabel(p.stage)}</span>
                  {p.openness === "anyone" && <span className="rounded-full bg-lime-300 px-3.5 py-1 text-sm font-bold text-zinc-900">🙌 Open to anyone</span>}
                  {slots.map((s) => <span key={s.id} className="rounded-full bg-violet-500 px-3.5 py-1 text-sm font-bold">{s.specialty}</span>)}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="fixed bottom-8 right-8 w-[280px] rotate-[1.5deg] rounded-[2rem] bg-white p-5 text-center text-zinc-900 shadow-[0_30px_80px_-20px_rgba(163,230,53,.45)] ring-4 ring-lime-300">
        <p className="font-display text-lg font-extrabold">Scan to join the board</p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code to join ${event.name}`} className="mx-auto mt-2 w-full" />
        )}
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">or enter code</p>
        <p className="font-mono text-4xl font-extrabold tracking-[0.2em]">{event.code}</p>
      </aside>

      {sponsors.length > 0 && (
        <footer className="relative flex items-center gap-6 border-t border-white/10 px-10 py-4 pr-[340px] text-zinc-400">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.25em]">Made possible by</span>
          {sponsors.map((s) => (
            <span key={s.id} className="flex items-center gap-2 text-lg font-semibold text-zinc-200">
              {s.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
              )}
              {s.name}
            </span>
          ))}
        </footer>
      )}

      {current && (
        <div key={current.id} role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-violet-950/95 via-brand/90 to-fuchsia-900/95 backdrop-blur-md">
          <Confetti count={60} />
          <div className="relative animate-pop px-10 text-center">
            <p className="font-mono text-lg font-bold uppercase tracking-[0.4em] text-lime-300">It&apos;s a match</p>
            <div className="mt-8 flex justify-center">
              <span className="rounded-full ring-8 ring-lime-300"><Avatar src={current.avatar} name={current.who} size={168} /></span>
            </div>
            <p className="mt-8 font-display text-7xl font-extrabold leading-[1.05]">
              {current.who} joined <span className="text-lime-300">{current.project}</span>
            </p>
            <p className="mt-4 text-4xl font-semibold text-violet-100">as {current.role} 🎉</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent: string }) {
  return (
    <div className="min-w-[140px] rounded-3xl bg-white/[0.06] px-6 py-4 text-center ring-1 ring-white/10">
      <p className={`font-display text-6xl font-extrabold tabular-nums leading-none ${accent}`}>{n}</p>
      <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
    </div>
  );
}
