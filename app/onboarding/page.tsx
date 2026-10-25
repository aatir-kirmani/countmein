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

  if (!userId) return <div className="skeleton mx-auto mt-10 h-64 max-w-md" />;

  return (
    <div className="mx-auto max-w-md space-y-5 pt-4">
      <p className="muted text-xs font-medium">Step {step} of 2</p>
      {step === 1 ? (
        <form onSubmit={saveStep1} className="space-y-5">
          <div>
            <h1 className="text-3xl font-extrabold">Hey there 👋</h1>
            <p className="muted text-sm">Two quick things and you&apos;re on the board.</p>
          </div>
          <div>
            <label htmlFor="name" className="label">Your name</label>
            <input id="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <TagPicker label="What are you good at?" options={SKILLS} value={skills} onChange={setSkills} />
          <button className="btn-primary min-h-[52px] w-full text-base" disabled={busy || !name.trim() || skills.length === 0}>
            {busy ? "Saving…" : !name.trim() ? "Add your name" : skills.length === 0 ? "Pick at least one skill" : "Continue"}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Stand out (optional)</h1>
            <p className="muted text-sm">Founders decide faster when they can see your work.</p>
          </div>
          <ProfileExtras value={extras} onChange={setExtras} userId={userId} />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => router.replace(next)}>Skip</button>
            <button className="btn-primary flex-1" onClick={saveStep2} disabled={busy}>{busy ? "Saving…" : "Save & continue"}</button>
          </div>
        </div>
      )}
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
    </div>
  );
}

export default function OnboardingPage() {
  return <Suspense><OnboardingInner /></Suspense>;
}
