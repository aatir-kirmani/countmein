"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Event code entry styled as a ticket stub: one real input behind six display boxes. */
export function TicketCode() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [going, setGoing] = useState(false);
  const ready = code.length === 6;

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return input.current?.focus();
    setGoing(true);
    router.push(`/e/${code}`);
  };

  return (
    <form onSubmit={go} className="relative mx-auto w-full max-w-md">
      <div className="ticket-edge relative overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(109,40,217,.45)] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex items-center justify-between border-b border-dashed border-zinc-300 px-6 py-3 dark:border-zinc-700">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-600 dark:text-zinc-300">Admit one builder</span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-brand dark:text-violet-300">№ 000{code.length}</span>
        </div>
        <div className="px-6 pb-5 pt-4">
          <label htmlFor="event-code" className="mb-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Got an event code? Punch it in.
          </label>
          <div className="relative" onClick={() => input.current?.focus()}>
            <input
              ref={input}
              id="event-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={6}
              className="absolute inset-0 z-10 w-full cursor-text opacity-0"
              aria-describedby="event-code-hint"
            />
            <div className="grid grid-cols-6 gap-2" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => {
                const ch = code[i];
                const active = focused && (i === code.length || (i === 5 && ready));
                return (
                  <div
                    key={i}
                    className={`flex aspect-[4/5] items-center justify-center rounded-xl font-mono text-2xl font-bold transition-all duration-150 sm:text-3xl ${
                      ch
                        ? "bg-brand text-white shadow-[0_4px_0_0_#4c1d95] -translate-y-0.5"
                        : active
                          ? "bg-violet-50 ring-2 ring-brand dark:bg-violet-950/60"
                          : "bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
                    }`}
                  >
                    {ch ?? (active ? <span className="h-7 w-0.5 animate-blink bg-brand" /> : <span className="text-zinc-400 dark:text-zinc-600">·</span>)}
                  </div>
                );
              })}
            </div>
          </div>
          <button
            className={`mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-all ${
              ready
                ? "bg-lime-300 text-zinc-900 shadow-[0_5px_0_0_#3f6212] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_0_#3f6212]"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {going ? "Opening the doors…" : ready ? <>Let me in <span aria-hidden>→</span></> : `${6 - code.length} more character${6 - code.length === 1 ? "" : "s"}`}
          </button>
          <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400" aria-hidden>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or<span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <Link
            href="/scan"
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-sm font-bold text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-zinc-900"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" /></svg>
            Scan the QR code
          </Link>
          <p id="event-code-hint" className="sr-only">Enter the 6-character code shown at the venue, or scan the QR code.</p>
        </div>
      </div>
    </form>
  );
}
