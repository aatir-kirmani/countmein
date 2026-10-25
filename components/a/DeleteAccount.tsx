"use client";
import { useState } from "react";
import { Sheet } from "@/components/b/Sheet";
import { useApp } from "@/components/Providers";

export function DeleteAccount() {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: text }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); return toast(data.error ?? "Something went wrong", { kind: "error" }); }
    try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch {}
    window.location.href = "/?deleted=1";
  };

  return (
    <section className="rounded-3xl p-5 ring-1 ring-inset ring-red-200 dark:ring-red-900/60">
      <h2 className="text-lg font-extrabold text-red-700 dark:text-red-400">Delete account</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Permanently removes your profile, projects, requests, messages and uploads. This can&apos;t be undone.</p>
      <button type="button" className="btn-danger btn-sm mt-4" onClick={() => setOpen(true)}>Delete my account</button>
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Delete your account?">
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Everything goes: your profile, projects you founded (and their project spaces), requests, messages, check-ins and uploaded photos. Collaborators lose access to projects you own.
          </p>
          <label className="block">
            <span className="label">Type DELETE to confirm</span>
            <input className="input font-mono" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setOpen(false)} disabled={busy}>Keep my account</button>
            <button type="button" className="btn-danger flex-1" disabled={text !== "DELETE" || busy} onClick={go}>{busy ? "Deleting…" : "Delete forever"}</button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
