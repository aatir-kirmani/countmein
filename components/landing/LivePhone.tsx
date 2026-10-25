"use client";
import { useEffect, useState } from "react";

const PROJECTS = [
  { name: "BuildFast", pitch: "Ship landing pages in 4 minutes", stage: "Building", needs: ["Designer", "Growth"], emoji: "⚡", hue: "bg-amber-200 text-amber-900" },
  { name: "Pawsitive", pitch: "Vet bookings for busy pet parents", stage: "Launched", needs: ["Backend"], emoji: "🐾", hue: "bg-sky-200 text-sky-900" },
  { name: "Quill.ai", pitch: "Newsletters that write themselves", stage: "Revenue", needs: ["Anyone"], emoji: "🪶", hue: "bg-emerald-200 text-emerald-900" },
  { name: "Tiny CRM", pitch: "A CRM for people who hate CRMs", stage: "Idea", needs: ["Frontend", "Sales"], emoji: "🧲", hue: "bg-rose-200 text-rose-900" },
];

const MATCHES = [
  "Sara joined BuildFast as Designer",
  "Dev joined Pawsitive as Backend",
  "Mia is in on Quill.ai",
  "Leo joined Tiny CRM as Frontend",
];

/** A phone showing a fake live board with match toasts popping in. Pure decoration. */
export function LivePhone() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 2600);
    return () => clearInterval(t);
  }, []);
  const tapped = i % PROJECTS.length;

  return (
    <div aria-hidden className="relative mx-auto w-[280px] select-none sm:w-[300px]">
      <div className="relative rounded-[2.6rem] bg-zinc-900 p-2.5 shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)] ring-1 ring-zinc-700">
        <div className="absolute left-1/2 top-3.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-[540px] overflow-hidden rounded-[2.1rem] bg-zinc-50 dark:bg-zinc-950">
          <div className="px-4 pb-2 pt-10">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-extrabold">Indie Hackers DXB</span>
              <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-white" /> LIVE
              </span>
            </div>
            <div className="mt-2 flex gap-1.5 text-[10px] font-semibold">
              <span className="rounded-full bg-brand px-2 py-1 text-white">✓ Needs my skills</span>
              <span className="rounded-full bg-white px-2 py-1 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">Stage</span>
              <span className="rounded-full bg-white px-2 py-1 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">42 here</span>
            </div>
          </div>
          <div className="space-y-2 px-3">
            {PROJECTS.map((p, k) => (
              <div
                key={p.name}
                className={`rounded-2xl bg-white p-3 ring-1 transition-all duration-500 dark:bg-zinc-900 ${
                  k === tapped ? "scale-[1.02] ring-2 ring-brand" : "ring-zinc-200 dark:ring-zinc-800"
                }`}
              >
                <div className="flex gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${p.hue}`}>{p.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-tight">{p.name} <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{p.stage}</span></p>
                    <p className="truncate text-[11px] text-zinc-600 dark:text-zinc-400">{p.pitch}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">Needs: {p.needs.join(", ")}</span>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors duration-300 ${k === tapped ? "bg-lime-300 text-zinc-900" : "bg-brand text-white"}`}>
                    {k === tapped ? "Sent ✓" : "Count me in"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div key={i} className="absolute inset-x-3 bottom-4 animate-rise rounded-2xl bg-zinc-900 px-3 py-2.5 text-[12px] font-semibold text-white shadow-xl dark:bg-white dark:text-zinc-900">
            🎉 {MATCHES[i % MATCHES.length]}
          </div>
        </div>
      </div>
    </div>
  );
}
