"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Bottom sheet on mobile (slides up, drag handle), centered dialog on larger screens. */
export function Sheet({ open, onClose, title, subtitle, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  // Portal to <body> so transformed/animated ancestors can't trap the fixed overlay.
  return createPortal(
    <div role="dialog" aria-modal aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="cmi-fade absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        tabIndex={-1}
        className="cmi-sheet relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 sm:rounded-[2rem] sm:px-6 sm:pt-6"
      >
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>}
          </div>
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            onClick={onClose} aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
      <style>{`
        .cmi-fade{animation:cmiFade .2s ease-out both}
        .cmi-sheet{animation:cmiUp .32s cubic-bezier(.2,.9,.25,1) both}
        @media (min-width:640px){.cmi-sheet{animation:cmiPop .22s cubic-bezier(.2,.9,.25,1) both}}
        @keyframes cmiFade{from{opacity:0}to{opacity:1}}
        @keyframes cmiUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes cmiPop{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}
      `}</style>
    </div>,
    document.body
  );
}
