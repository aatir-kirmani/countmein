"use client";
import { LINK_FIELDS, LOOKING_FOR } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { ImageUpload } from "@/components/ui/ImageUpload";

export type Extras = Pick<Profile, "avatar_url" | "bio" | "links" | "hours_per_week" | "looking_for"> & { contact_phone: string };

/** Optional profile fields shared by onboarding step 2 and /me. */
export function ProfileExtras({ value, onChange, userId }: { value: Extras; onChange: (v: Extras) => void; userId: string }) {
  const set = <K extends keyof Extras>(k: K, v: Extras[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <ImageUpload label="Photo" value={value.avatar_url} onChange={(u) => set("avatar_url", u)} userId={userId} />
      <div>
        <label htmlFor="bio" className="label">One-line bio</label>
        <input id="bio" className="input" maxLength={160} value={value.bio ?? ""} onChange={(e) => set("bio", e.target.value)} placeholder="Ex-Stripe engineer building tools for creators" />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Links</legend>
        {LINK_FIELDS.map((f) => (
          <input key={f.key} aria-label={f.label} className="input" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder={`${f.label} URL`}
            value={value.links?.[f.key] ?? ""} onChange={(e) => set("links", { ...value.links, [f.key]: e.target.value })} />
        ))}
      </fieldset>
      <div>
        <label htmlFor="hours" className="label">Hours per week available</label>
        <input id="hours" className="input" type="number" min={0} max={80} inputMode="numeric"
          value={value.hours_per_week ?? ""} onChange={(e) => set("hours_per_week", e.target.value === "" ? null : Number(e.target.value))} />
      </div>
      <fieldset>
        <legend className="label">Looking for</legend>
        <div className="flex flex-wrap gap-2">
          {LOOKING_FOR.map((o) => {
            const on = value.looking_for.includes(o.value);
            return (
              <button type="button" key={o.value} aria-pressed={on}
                onClick={() => set("looking_for", on ? value.looking_for.filter((x) => x !== o.value) : [...value.looking_for, o.value])}
                className={`min-h-[40px] rounded-full px-3.5 text-sm font-medium ring-1 ${on ? "bg-brand text-white ring-brand" : "bg-white ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700"}`}>
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div>
        <label htmlFor="phone" className="label">Phone (only shared with accepted collaborators)</label>
        <input id="phone" className="input" type="tel" autoComplete="tel" value={value.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
      </div>
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
