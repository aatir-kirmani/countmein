"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Whole phrases so the verb always agrees ("pizza runs", "donuts run").
const SNACKS = [
  { text: "the pizza runs out", emoji: "🍕" },
  { text: "the donuts run out", emoji: "🍩" },
  { text: "the coffee runs out", emoji: "☕" },
  { text: "the tacos run out", emoji: "🌮" },
  { text: "the cookies run out", emoji: "🍪" },
  { text: "the chai runs out", emoji: "🫖" },
  { text: "the sushi runs out", emoji: "🍣" },
];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Hero line that swaps snacks every 2 seconds. It sits on its own line and is scaled so the
 * longest phrase fits the available width, so nothing overflows and the headline never jumps.
 * Static for reduced-motion users and screen readers.
 */
export function RotatingSnack() {
  const [i, setI] = useState(0);
  const [scale, setScale] = useState(1);
  const line = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % SNACKS.length), 2000);
    return () => clearInterval(t);
  }, []);

  useIsoLayoutEffect(() => {
    const el = line.current;
    const m = measure.current;
    if (!el || !m) return;
    const fit = () => {
      const available = el.parentElement?.clientWidth ?? el.clientWidth;
      const widest = Math.max(...Array.from(m.children).map((c) => (c as HTMLElement).offsetWidth));
      setScale(widest > 0 ? Math.min(1, (available - 4) / widest) : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, []);

  const s = SNACKS[i];
  return (
    <>
      <span className="sr-only">the pizza runs out</span>
      <span ref={line} aria-hidden className="block whitespace-nowrap" style={{ fontSize: `${scale}em` }}>
        <span key={i} className="inline-block animate-snack">
          {s.text}
          <span className="ml-1 inline-block origin-bottom motion-safe:animate-wiggle">{s.emoji}</span>
        </span>
      </span>
      {/* Invisible copies at full size, used to find the widest phrase. */}
      <span ref={measure} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden whitespace-nowrap">
        {SNACKS.map((x) => (
          <span key={x.text} className="inline-block">{x.text}<span className="ml-1 inline-block">{x.emoji}</span></span>
        ))}
      </span>
    </>
  );
}
