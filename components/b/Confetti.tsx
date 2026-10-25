"use client";
import { useMemo } from "react";

/** One-shot emoji confetti burst. Render it conditionally; it removes nothing on its own and is purely decorative. */
export function Confetti({ count = 26, emojis = ["🎉", "✨", "🍕", "🚀", "💜", "🙌"] }: { count?: number; emojis?: string[] }) {
  const bits = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      e: emojis[i % emojis.length],
      x: Math.round((Math.random() - 0.5) * 340),
      y: Math.round(-140 - Math.random() * 180),
      r: Math.round((Math.random() - 0.5) * 540),
      d: Math.round(Math.random() * 120),
      s: 0.8 + Math.random() * 0.9,
    })),
    [count, emojis]
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {bits.map((b, i) => (
        <span
          key={i}
          className="cmi-confetti absolute left-1/2 top-1/2"
          style={{ ["--x" as string]: `${b.x}px`, ["--y" as string]: `${b.y}px`, ["--r" as string]: `${b.r}deg`, animationDelay: `${b.d}ms`, fontSize: `${b.s * 22}px` }}
        >
          {b.e}
        </span>
      ))}
      <style>{`
        .cmi-confetti{opacity:0;animation:cmiBurst 1.6s cubic-bezier(.15,.7,.3,1) forwards}
        @keyframes cmiBurst{
          0%{transform:translate(-50%,-50%) scale(.3);opacity:0}
          15%{opacity:1}
          60%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r)) scale(1);opacity:1}
          100%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y) + 160px)) rotate(var(--r)) scale(.9);opacity:0}
        }
        @media (prefers-reduced-motion: reduce){.cmi-confetti{display:none}}
      `}</style>
    </div>
  );
}
