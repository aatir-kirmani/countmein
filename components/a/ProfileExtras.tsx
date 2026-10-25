"use client";
import { LINK_FIELDS, LOOKING_FOR } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Field, Stepper } from "@/components/ui/Form";

export type Extras = Pick<Profile, "avatar_url" | "bio" | "links" | "hours_per_week" | "looking_for"> & { contact_phone: string };

const LINK_HINTS: Record<string, string> = {
  x: "x.com/yourhandle", linkedin: "linkedin.com/in/you", github: "github.com/you", website: "yoursite.com", portfolio: "dribbble.com/you",
};
const LINK_ICONS: Record<string, string> = { x: "𝕏", linkedin: "in", github: "gh", website: "www", portfolio: "★" };
const LOOKING_ICONS: Record<string, string> = { cofounder: "🤝", paid_gig: "💸", side_project: "🌙", helping: "🙌" };

/** Optional profile fields shared by onboarding step 2 and /me. `sections` lets /me split them into cards. */
export function ProfileExtras({
  value, onChange, userId, part = "all",
}: { value: Extras; onChange: (v: Extras) => void; userId: string; part?: "all" | "about" | "links" | "availability" | "contact" }) {
  const set = <K extends keyof Extras>(k: K, v: Extras[K]) => onChange({ ...value, [k]: v });
  const show = (p: typeof part) => part === "all" || part === p;
  const bio = value.bio ?? "";

  return (
    <div className="space-y-5">
      {show("about") && (
        <>
          <ImageUpload label="Photo" shape="round" value={value.avatar_url} onChange={(u) => set("avatar_url", u)} userId={userId} hint="A friendly face helps people find you in the room." />
          <Field label="One-line bio" htmlFor="bio" counter={{ value: bio.length, max: 160 }} hint="What you do, in a sentence people remember.">
            <input id="bio" className="input" maxLength={160} value={bio} onChange={(e) => set("bio", e.target.value)} placeholder="Ex-Stripe engineer building tools for creators" />
          </Field>
        </>
      )}

      {show("availability") && (
        <>
          <fieldset>
            <legend className="label">Looking for</legend>
            <div className="grid grid-cols-2 gap-2">
              {LOOKING_FOR.map((o) => {
                const on = value.looking_for.includes(o.value);
                return (
                  <button
                    type="button" key={o.value} aria-pressed={on}
                    onClick={() => set("looking_for", on ? value.looking_for.filter((x) => x !== o.value) : [...value.looking_for, o.value])}
                    className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl px-3.5 text-left text-sm font-bold ring-1 ring-inset transition active:scale-[.98] ${
                      on ? "bg-violet-50 text-violet-900 ring-2 ring-brand dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-400" : "bg-zinc-50 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900/60 dark:ring-zinc-800"
                    }`}
                  >
                    <span aria-hidden className="text-lg">{LOOKING_ICONS[o.value]}</span>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Field label="Hours per week" htmlFor="hours" optional hint="Roughly how much time you could give a project.">
            <Stepper
              id="hours" min={0} max={80} step={1} suffix="hrs" placeholder="Not sure"
              value={value.hours_per_week == null ? "" : String(value.hours_per_week)}
              onChange={(v) => set("hours_per_week", v === "" ? null : Math.max(0, Math.min(80, Math.round(Number(v)))))}
            />
          </Field>
        </>
      )}

      {show("links") && (
        <fieldset>
          <legend className="label">Links <span className="text-xs font-medium text-zinc-400">optional</span></legend>
          <div className="space-y-2">
            {LINK_FIELDS.map((f) => (
              <div key={f.key} className="relative">
                <span aria-hidden className="pointer-events-none absolute left-1.5 top-1.5 flex h-9 w-11 items-center justify-center rounded-xl bg-white font-mono text-xs font-bold text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                  {LINK_ICONS[f.key]}
                </span>
                <input
                  aria-label={f.label} className="input pl-16" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off"
                  placeholder={LINK_HINTS[f.key]} value={value.links?.[f.key] ?? ""}
                  onChange={(e) => set("links", { ...value.links, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {show("contact") && (
        <Field label="Phone" htmlFor="phone" optional hint="🔒 Only shared with people you match with.">
          <input id="phone" className="input" type="tel" autoComplete="tel" value={value.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+971 50 123 4567" />
        </Field>
      )}
    </div>
  );
}

/** Adds https:// to bare domains like "buildfast.com"; returns null for blanks. */
export function normalizeUrl(v: string | null | undefined) {
  const t = (v ?? "").trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, "")}`;
}

export function cleanLinks(links: Extras["links"]) {
  return Object.fromEntries(
    Object.entries(links ?? {}).map(([k, v]) => [k, normalizeUrl(v)] as const).filter(([, v]) => v)
  );
}
