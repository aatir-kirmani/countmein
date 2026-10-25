"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILLS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { TagPicker } from "@/components/ui/TagPicker";
import { Field, FormSection, StickyActions } from "@/components/ui/Form";
import { useApp } from "@/components/Providers";
import { ProfileExtras, cleanLinks, type Extras } from "./ProfileExtras";

export function ProfileEditor({ profile, contact }: { profile: Profile; contact: { contact_email: string; contact_phone: string } }) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [skills, setSkills] = useState(profile.skills ?? []);
  const [email, setEmail] = useState(contact.contact_email);
  const [extras, setExtras] = useState<Extras>({
    avatar_url: profile.avatar_url, bio: profile.bio ?? "", links: profile.links ?? {},
    hours_per_week: profile.hours_per_week, looking_for: profile.looking_for ?? [], contact_phone: contact.contact_phone,
  });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (uname.length < 2) return toast("Usernames need at least 2 letters, numbers or underscores", { kind: "error" });
    if (skills.length === 0) return toast("Pick at least one skill so founders can find you", { kind: "error" });
    setBusy(true);
    const { contact_phone, ...rest } = extras;
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ ...rest, bio: rest.bio || null, links: cleanLinks(rest.links), name: name.trim(), username: uname, skills, onboarded: true }).eq("id", profile.id),
      supabase.from("user_contacts").update({ contact_email: email || null, contact_phone: contact_phone || null }).eq("user_id", profile.id),
    ]);
    setBusy(false);
    const error = a.error || b.error;
    if (error) toast(error.code === "23505" ? "That username is taken" : error.message, { kind: "error" });
    else { setUsername(uname); setDirty(false); toast("Profile saved", { kind: "success" }); router.refresh(); }
  };

  return (
    <form onSubmit={save} className="space-y-4" id="profile">
      <FormSection step={1} title="The basics" description="How you show up on the board.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="pname" required>
            <input id="pname" required className="input" value={name} onChange={(e) => touch(setName)(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Username" htmlFor="uname" required hint={`countmein.app/u/${username || "you"}`}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-zinc-400">@</span>
              <input id="uname" required className="input pl-9" value={username} maxLength={30} autoCapitalize="none" autoCorrect="off"
                onChange={(e) => touch(setUsername)(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
            </div>
          </Field>
        </div>
        <ProfileExtras part="about" value={extras} onChange={touch(setExtras)} userId={profile.id} />
      </FormSection>

      <FormSection step={2} title="Your superpowers" description="We match these against the roles founders need.">
        <TagPicker label="Skills" options={SKILLS} value={skills} onChange={touch(setSkills)} />
        <ProfileExtras part="availability" value={extras} onChange={touch(setExtras)} userId={profile.id} />
      </FormSection>

      <FormSection step={3} title="Show your work" description="Founders say yes faster when they can see what you've made.">
        <ProfileExtras part="links" value={extras} onChange={touch(setExtras)} userId={profile.id} />
      </FormSection>

      <FormSection step={4} title="Private contact" description="Hidden from everyone until you match on a project.">
        <Field label="Contact email" htmlFor="cemail" hint="🔒 Only shared with people you match with.">
          <input id="cemail" type="email" className="input" value={email} onChange={(e) => touch(setEmail)(e.target.value)} autoComplete="email" />
        </Field>
        <ProfileExtras part="contact" value={extras} onChange={touch(setExtras)} userId={profile.id} />
      </FormSection>

      <StickyActions>
        <p className="hidden flex-1 text-sm text-zinc-500 sm:block dark:text-zinc-400">{dirty ? "You have unsaved changes." : "All changes saved."}</p>
        <button className="btn-primary w-full sm:w-auto sm:min-w-[180px]" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
      </StickyActions>
    </form>
  );
}
