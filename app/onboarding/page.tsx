"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILLS } from "@/lib/constants";
import { TagPicker } from "@/components/ui/TagPicker";
import { ProfileExtras, cleanLinks, type Extras } from "@/components/a/ProfileExtras";

function OnboardingInner() {
  const supabase = createClient();
  const router = useRouter();
  let next = useSearchParams().get("next") || "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [extras, setExtras] = useState<Extras>({ avatar_url: null, bio: "", links: {}, hours_per_week: null, looking_for: [], contact_phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace(`/login?next=${encodeURIComponent(next)}`);
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      // GitHub accounts often have no display name; fall back to the handle or email prefix.
      const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
      const fallbackName = meta.full_name || meta.name || meta.user_name || meta.preferred_username || user.email?.split("@")[0] || "";
      if (p) {
        setName(p.name || fallbackName); setSkills(p.skills ?? []);
        setExtras((x) => ({ ...x, avatar_url: p.avatar_url, bio: p.bio ?? "", links: p.links ?? {}, hours_per_week: p.hours_per_week, looking_for: p.looking_for ?? [] }));
      }
    })();
  }, [supabase, router, next]);

  const saveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.from("profiles").update({ name: name.trim(), skills, onboarded: true }).eq("id", userId).select("id");
    setBusy(false);
    if (error) setErr(error.message);
    else if (!data?.length) setErr("We couldn't find your profile. Sign out and back in, then try again.");
    else setStep(2);
  };

  const saveStep2 = async () => {
    if (!userId) return;
    setBusy(true); setErr(null);
    const { contact_phone, ...rest } = extras;
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ ...rest, bio: rest.bio || null, links: cleanLinks(rest.links) }).eq("id", userId),
      supabase.from("user_contacts").update({ contact_phone: contact_phone || null }).eq("user_id", userId),
    ]);
    setBusy(false);
    const error = a.error || b.error;
    if (error) setErr(error.message); else router.replace(next);
  };

  if (!userId) return <div className="skeleton mx-auto mt-10 h-96 max-w-md rounded-3xl" />;

  const ready = !!name.trim() && skills.length > 0;
  const first = name.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-md pt-2">
      <div className="mb-6 flex items-center gap-3" aria-label={`Step ${step} of 2`}>
        {[1, 2].map((n) => (
          <div key={n} className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className={`h-full rounded-full bg-brand transition-all duration-500 ${step >= n ? "w-full" : "w-0"}`} />
          </div>
        ))}
        <span className="font-mono text-xs font-bold text-zinc-500">{step}/2</span>
      </div>

      {step === 1 ? (
        <form onSubmit={saveStep1} className="space-y-7">
          <div>
            <p className="eyebrow">Your name tag</p>
            <h1 className="mt-1 text-4xl font-extrabold leading-tight">Hey{first ? `, ${first}` : " there"} <span className="inline-block origin-bottom-right motion-safe:animate-wiggle">👋</span></h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Two quick things and you&apos;re on the board.</p>
          </div>

          <div className="overflow-hidden rounded-3xl bg-white shadow-[0_20px_50px_-25px_rgba(109,40,217,.45)] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="bg-brand px-5 py-2.5 text-center text-white">
              <p className="font-display text-lg font-extrabold uppercase leading-none tracking-wide">Hello</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-200">my name is</p>
            </div>
            <div className="p-4">
              <label htmlFor="name" className="sr-only">Your name</label>
              <input
                id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name"
                className="w-full border-0 bg-transparent text-center font-display text-3xl font-bold italic text-zinc-900 placeholder:text-zinc-300 focus:outline-none dark:text-white dark:placeholder:text-zinc-700"
              />
              <div className="mx-auto mt-1 h-0.5 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <p className="mt-2 min-h-[1.25rem] text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {skills.length ? skills.slice(0, 3).join(" · ") + (skills.length > 3 ? ` +${skills.length - 3}` : "") : "Pick your skills below"}
              </p>
            </div>
          </div>

          <TagPicker label="What are you good at?" hint="Pick all that apply. Founders filter by these." options={SKILLS} value={skills} onChange={setSkills} size="lg" />

          <div className="sticky bottom-16 z-10 -mx-4 bg-gradient-to-t from-zinc-50 from-60% to-transparent px-4 pb-3 pt-6 sm:bottom-0 dark:from-zinc-950">
            <button className={`w-full text-base ${ready ? "btn-accent min-h-[56px]" : "btn-secondary min-h-[56px]"}`} disabled={busy || !ready}>
              {busy ? "Saving…" : !name.trim() ? "Add your name" : skills.length === 0 ? "Pick at least one skill" : <>Put me on the board <span aria-hidden>→</span></>}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="eyebrow">Optional, but it helps</p>
            <h1 className="mt-1 text-4xl font-extrabold leading-tight">Stand out a little ✨</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Founders say yes faster when they can see your face and your work. Skip anything you like.</p>
          </div>
          <div className="card p-5">
            <ProfileExtras value={extras} onChange={setExtras} userId={userId} />
          </div>
          <div className="sticky bottom-16 z-10 -mx-4 flex gap-2 bg-gradient-to-t from-zinc-50 from-60% to-transparent px-4 pb-3 pt-6 sm:bottom-0 dark:from-zinc-950">
            <button className="btn-secondary min-h-[56px] flex-1" onClick={() => router.replace(next)}>Skip for now</button>
            <button className="btn-primary min-h-[56px] flex-[1.4]" onClick={saveStep2} disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
          </div>
        </div>
      )}
      {err && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">{err}</p>}
    </div>
  );
}

export default function OnboardingPage() {
  return <Suspense><OnboardingInner /></Suspense>;
}
