"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILLS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { TagPicker } from "@/components/ui/TagPicker";
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { contact_phone, ...rest } = extras;
    const uname = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ ...rest, bio: rest.bio || null, links: cleanLinks(rest.links), name: name.trim(), username: uname, skills, onboarded: true }).eq("id", profile.id),
      supabase.from("user_contacts").update({ contact_email: email || null, contact_phone: contact_phone || null }).eq("user_id", profile.id),
    ]);
    setBusy(false);
    const error = a.error || b.error;
    if (error) toast(error.code === "23505" ? "That username is taken" : error.message, { kind: "error" });
    else { toast("Profile saved", { kind: "success" }); router.refresh(); }
  };

  return (
    <form onSubmit={save} className="card space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pname" className="label">Name</label>
          <input id="pname" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="uname" className="label">Username</label>
          <input id="uname" required className="input" value={username} onChange={(e) => setUsername(e.target.value)} pattern="[a-zA-Z0-9_]{2,30}" />
        </div>
      </div>
      <TagPicker label="Skills" options={SKILLS} value={skills} onChange={setSkills} />
      <div>
        <label htmlFor="cemail" className="label">Contact email (only shared with accepted collaborators)</label>
        <input id="cemail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <ProfileExtras value={extras} onChange={setExtras} userId={profile.id} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
