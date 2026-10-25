"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EventCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (clean.length === 6) router.push(`/e/${clean}`); }} className="flex gap-2">
      <label htmlFor="code" className="sr-only">Event code</label>
      <input
        id="code" className="input text-center font-mono text-lg uppercase tracking-[0.3em]" placeholder="ABC123"
        value={clean} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" inputMode="text" maxLength={6}
      />
      <button className="btn-primary" disabled={clean.length !== 6}>Go</button>
    </form>
  );
}
