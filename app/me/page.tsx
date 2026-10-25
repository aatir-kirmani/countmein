import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/a/ProfileEditor";
import { SignOutButton } from "@/components/a/SignOutButton";
import { StageBadge } from "@/components/ui/Badges";
import { Empty } from "@/components/ui/Empty";
import { eventStatus, fmtDate } from "@/lib/utils";
import type { EventRow, Project } from "@/lib/types";

export default async function MePage() {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) redirect("/login?next=/me");

  const [{ data: contact }, { data: projects }, { data: checkins }, { data: memberships }] = await Promise.all([
    supabase.from("user_contacts").select("contact_email, contact_phone").eq("user_id", user.id).single(),
    supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("event_checkins").select("checked_in_at, events(*)").eq("user_id", user.id).order("checked_in_at", { ascending: false }),
    supabase.from("project_members").select("role, projects(*)").eq("user_id", user.id).neq("role", "Founder"),
  ]);

  const events = (checkins ?? []).map((c: { events: unknown }) => c.events as EventRow).filter(Boolean);
  const joined = (memberships ?? []).map((m: { role: string; projects: unknown }) => ({ role: m.role, project: m.projects as Project })).filter((m) => m.project);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My profile</h1>
        <div className="flex gap-2">
          <Link href={`/u/${profile.username}`} className="btn-ghost text-sm">View public</Link>
          <SignOutButton />
        </div>
      </div>

      <ProfileEditor profile={profile} contact={{ contact_email: contact?.contact_email ?? "", contact_phone: contact?.contact_phone ?? "" }} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My projects</h2>
          <Link href="/me/projects/new" className="btn-primary">+ New project</Link>
        </div>
        {(projects ?? []).length === 0 ? (
          <Empty title="No projects yet" body="Post what you're building so people can count themselves in." />
        ) : (
          (projects as Project[]).map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Link href={`/p/${p.id}`} className="font-semibold hover:underline">{p.name}</Link><StageBadge stage={p.stage} /></div>
                <p className="muted truncate text-sm">{p.pitch}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/space/${p.id}`} className="btn-secondary">Space</Link>
                <Link href={`/me/projects/${p.id}/edit`} className="btn-secondary">Edit</Link>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Projects I&apos;ve joined</h2>
        {joined.length === 0 ? (
          <p className="muted text-sm">Nothing yet. Tap “Count me in” on a project at your next event.</p>
        ) : (
          joined.map(({ role, project }) => (
            <Link key={project.id} href={`/space/${project.id}`} className="card flex items-center justify-between p-4">
              <div><p className="font-semibold">{project.name}</p><p className="muted text-sm">{role}</p></div>
              <span className="text-sm font-medium text-brand">Open space →</span>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My events</h2>
        {events.length === 0 ? (
          <p className="muted text-sm">No events yet.</p>
        ) : (
          events.map((e) => (
            <Link key={e.id} href={`/e/${e.code}`} className="card flex items-center justify-between p-4">
              <div><p className="font-semibold">{e.name}</p><p className="muted text-xs">{fmtDate(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</p></div>
              <span className="chip bg-zinc-100 dark:bg-zinc-800">{eventStatus(e)}</span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
