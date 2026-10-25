"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Providers switched on in Supabase. Google shows only once configured (set NEXT_PUBLIC_AUTH_PROVIDERS=github,google).
const PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS || "github").split(",").map((s) => s.trim()) as ("github" | "google")[];
const LABELS = { github: "Continue with GitHub", google: "Continue with Google" };

function LoginInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  let next = params.get("next") || "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) next = "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(params.get("error"));
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // Already signed in? Skip straight to where they were going.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: unknown } }) => { if (data.user) router.replace(next); });
  }, [supabase, router, next]);

  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email"); setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    setBusy(null);
    if (!error) return setSent(true);
    setErr(/rate limit|too many/i.test(error.message)
      ? "Too many email sign-ins right now. Use GitHub, or try again in a few minutes."
      : error.message);
  };
  const oauth = async (provider: "google" | "github") => {
    setBusy(provider); setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (error) { setBusy(null); setErr(error.message); }
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold">You&apos;re almost in</h1>
        <p className="muted mt-1 text-sm">One tap and you&apos;re on the board.</p>
      </div>
      <div className="grid gap-2">
        {PROVIDERS.filter((p) => p in LABELS).map((p, i) => (
          <button key={p} className={i === 0 ? "btn-primary min-h-[52px] text-base" : "btn-secondary"} onClick={() => oauth(p)} disabled={!!busy}>
            {busy === p ? "Opening…" : LABELS[p]}
          </button>
        ))}
      </div>
      <div className="muted flex items-center gap-3 text-xs"><span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />or use email<span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" /></div>
      {sent ? (
        <div className="card space-y-1 p-4 text-center" role="status">
          <p className="text-2xl" aria-hidden>📬</p>
          <p className="font-semibold">Check your email</p>
          <p className="muted text-sm">We sent a sign-in link to <strong>{email}</strong>. Open it on this device.</p>
          <button className="btn-ghost mt-2 text-sm" onClick={() => setSent(false)}>Use a different email</button>
        </div>
      ) : (
        <form onSubmit={magic} className="space-y-2">
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" inputMode="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="btn-secondary w-full" disabled={!!busy}>{busy === "email" ? "Sending…" : "Email me a magic link"}</button>
        </form>
      )}
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">{err}</p>}
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
