"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Providers switched on in Supabase. Google shows only once configured (set NEXT_PUBLIC_AUTH_PROVIDERS=github,google).
const PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS || "github").split(",").map((s) => s.trim()) as ("github" | "google")[];
const LABELS = { github: "Continue with GitHub", google: "Continue with Google" };

function ProviderIcon({ p }: { p: "github" | "google" }) {
  if (p === "github") {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 0 1 0-12.4c1.9 0 3.2.8 3.9 1.5l2.7-2.6A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7H12Z" />
    </svg>
  );
}

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
  const toEvent = next.match(/^\/e\/([A-Z0-9]{6})/i)?.[1]?.toUpperCase();

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
    <div className="relative mx-auto max-w-md pt-6 sm:pt-12">
      <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-400/25 via-fuchsia-300/15 to-lime-200/25 blur-3xl dark:from-violet-700/25 dark:to-lime-500/10" />

      <div className="relative text-center">
        <span aria-hidden className="inline-flex h-16 w-16 rotate-[-8deg] items-center justify-center rounded-3xl bg-lime-300 text-3xl shadow-[0_5px_0_0_#4d7c0f]">✋</span>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight">
          {toEvent ? <>One tap and<br />you&apos;re in.</> : <>Welcome to<br />the room.</>}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-zinc-600 dark:text-zinc-400">
          {toEvent
            ? <>Sign in to check in to event <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 font-mono text-sm font-bold text-white dark:bg-white dark:text-zinc-900">{toEvent}</span>.</>
            : "Sign in to post projects, count yourself in, and meet your next collaborator."}
        </p>
      </div>

      <div className="card relative mt-8 space-y-4 p-5 shadow-[0_20px_60px_-25px_rgba(109,40,217,.35)] sm:p-6">
        <div className="grid gap-2.5">
          {PROVIDERS.filter((p) => p in LABELS).map((p) => (
            <button
              key={p}
              onClick={() => oauth(p)}
              disabled={!!busy}
              className={p === "github"
                ? "btn min-h-[54px] w-full bg-zinc-900 text-base text-white shadow-[0_4px_0_0_#000] hover:-translate-y-px active:shadow-none dark:bg-white dark:text-zinc-900 dark:shadow-[0_4px_0_0_#a1a1aa]"
                : "btn-secondary min-h-[54px] w-full text-base"}
            >
              <ProviderIcon p={p} />
              {busy === p ? "Opening…" : LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or get a magic link<span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {sent ? (
          <div className="rounded-2xl bg-lime-50 p-5 text-center ring-1 ring-lime-200 dark:bg-lime-950/30 dark:ring-lime-900" role="status">
            <p className="text-3xl" aria-hidden>📬</p>
            <p className="mt-1 font-display text-lg font-extrabold">Check your inbox</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">We sent a link to <strong className="text-zinc-900 dark:text-white">{email}</strong>. Open it on this device to sign in.</p>
            <button className="btn-ghost btn-sm mt-3" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={magic} className="space-y-2.5">
            <label htmlFor="email" className="sr-only">Email</label>
            <input id="email" type="email" required autoComplete="email" inputMode="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className="btn-secondary w-full" disabled={!!busy || !email.trim()}>{busy === "email" ? "Sending…" : "Email me a link"}</button>
          </form>
        )}

        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">{err}</p>}
      </div>

      <p className="relative mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
        🔒 Your email and phone stay private until you match with someone.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
