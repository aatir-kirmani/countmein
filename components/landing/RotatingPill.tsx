"use client";
import { useEffect, useState } from "react";

const LINES = ["Skip the small talk. Start building.", "Networking, minus the awkward."];

/** Text for the hero pill that alternates between taglines. Both lines share one grid cell so the pill never resizes. */
export function RotatingPill() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % LINES.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="grid" aria-live="off">
      {LINES.map((l, k) => (
        <span
          key={l}
          aria-hidden={k !== i}
          className={`col-start-1 row-start-1 transition-all duration-500 ${k === i ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"}`}
        >
          {l}
        </span>
      ))}
    </span>
  );
}
