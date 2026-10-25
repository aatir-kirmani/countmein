"use client";
import { useRef, useState } from "react";
import type { EventRow } from "@/lib/types";

type Media = { kind: "image" | "video"; url: string };

/** Event cover carousel: optional video first, then cover + gallery images. Swipeable, with dots. */
export function EventMedia({ event, className = "" }: { event: Pick<EventRow, "name" | "cover_url" | "gallery_urls" | "video_url">; className?: string }) {
  const items: Media[] = [
    ...(event.video_url ? [{ kind: "video" as const, url: event.video_url }] : []),
    ...[event.cover_url, ...(event.gallery_urls ?? [])].filter((u): u is string => !!u).map((url) => ({ kind: "image" as const, url })),
  ];
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  if (items.length === 0) return null;

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-zinc-200 dark:bg-zinc-800 ${className}`}>
      <div
        ref={track}
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex aspect-[16/9] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label={`${event.name} media`}
      >
        {items.map((m, i) => (
          <div key={m.url} className="relative h-full w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} of ${items.length}`}>
            {m.kind === "video" ? (
              <video src={m.url} className="h-full w-full object-cover" autoPlay muted loop playsInline controls preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt={i === 0 || (event.video_url && i === 1) ? `${event.name} cover` : ""} className="h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
            )}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button type="button" onClick={() => go(Math.max(0, active - 1))} aria-label="Previous" className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur sm:flex">‹</button>
          <button type="button" onClick={() => go(Math.min(items.length - 1, active + 1))} aria-label="Next" className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur sm:flex">›</button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {items.map((m, i) => (
              <button
                key={m.url} type="button" onClick={() => go(i)} aria-label={`Show ${m.kind} ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-2 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
