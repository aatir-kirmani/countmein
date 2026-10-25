"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const supabase = createClient();
  const next = useSearchParams().get("next") || "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };
  const oauth = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (error) setErr(error.message);
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sign in to Countmein</h1>
        <p className="muted mt-1 text-sm">One tap and you&apos;re in.</p>
      </div>
      <div className="grid gap-2">
        <button className="btn-secondary" onClick={() => oauth("google")}>Continue with Google</button>
        <button className="btn-secondary" onClick={() => oauth("github")}>Continue with GitHub</button>
      </div>
      <div className="muted flex items-center gap-3 text-xs"><span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />or<span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" /></div>
      {sent ? (
        <div className="card p-4 text-center" role="status">
          <p className="font-semibold">Check your email</p>
          <p className="muted text-sm">We sent a sign-in link to {email}.</p>
        </div>
      ) : (
        <form onSubmit={magic} className="space-y-2">
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Email me a magic link"}</button>
        </form>
      )}
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
