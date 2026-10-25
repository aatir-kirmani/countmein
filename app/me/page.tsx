import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/a/ProfileEditor";
import { SignOutButton } from "@/components/a/SignOutButton";
import { BlockButton } from "@/components/a/BlockButton";
import { StageBadge } from "@/components/ui/Badges";
import { Empty } from "@/components/ui/Empty";
import { eventStatus, fmtDate } from "@/lib/utils";
import type { EventRow, Project } from "@/lib/types";

export default async function MePage() {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) redirect("/login?next=/me");

  const [{ data: contact }, { data: projects }, { data: checkins }, { data: memberships }, { data: blocks }] = await Promise.all([
    supabase.from("user_contacts").select("contact_email, contact_phone").eq("user_id", user.id).single(),
    supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("event_checkins").select("checked_in_at, events(*)").eq("user_id", user.id).order("checked_in_at", { ascending: false }),
    supabase.from("project_members").select("role, projects(*)").eq("user_id", user.id),
    supabase.from("blocks").select("blocked_id, profiles!blocks_blocked_id_fkey(name, username)").eq("blocker_id", user.id),
  ]);

  const events = (checkins ?? []).map((c: { events: unknown }) => c.events as EventRow).filter(Boolean);
  const joined = (memberships ?? []).map((m: { role: string; projects: unknown }) => ({ role: m.role, project: m.projects as Project })).filter((m) => m.project && m.project.owner_id !== user.id);
  const blocked = (blocks ?? []).map((b: { blocked_id: string; profiles: unknown }) => ({ id: b.blocked_id, who: b.profiles as { name: string; username: string } | null }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-extrabold">My profile</h1>
        <div className="flex gap-2">
          <Link href={`/u/${profile.username}`} className="btn-ghost text-sm">View public</Link>
          <SignOutButton />
        </div>
      </div>

      <nav aria-label="Shortcuts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/inbox" className="card p-4 text-sm font-semibold transition hover:-translate-y-0.5"><span aria-hidden className="block text-xl">📬</span>Inbox</Link>
        <Link href="/organizer" className="card p-4 text-sm font-semibold transition hover:-translate-y-0.5"><span aria-hidden className="block text-xl">🎤</span>Host events</Link>
        <Link href="/me/projects/new" className="card p-4 text-sm font-semibold transition hover:-translate-y-0.5"><span aria-hidden className="block text-xl">🚀</span>New project</Link>
        {profile.is_admin && (
          <Link href="/admin" className="card p-4 text-sm font-semibold transition hover:-translate-y-0.5"><span aria-hidden className="block text-xl">🛡️</span>Admin</Link>
        )}
      </nav>

      <ProfileEditor profile={profile} contact={{ contact_email: contact?.contact_email ?? "", contact_phone: contact?.contact_phone ?? "" }} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My projects</h2>
          <Link href="/me/projects/new" className="btn-primary">+ New project</Link>
        </div>
        {(projects ?? []).length === 0 ? (
          <Empty title="No projects yet" body="Post what you're building so people can count themselves in." action={<Link href="/me/projects/new" className="btn-primary">Post your first project</Link>} />
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
          <p className="muted text-sm">No events yet. Scan the QR code at your next meetup, or enter the code on the <Link href="/" className="font-medium text-brand underline">home page</Link>.</p>
        ) : (
          events.map((e) => (
            <Link key={e.id} href={`/e/${e.code}`} className="card flex items-center justify-between p-4">
              <div><p className="font-semibold">{e.name}</p><p className="muted text-xs">{fmtDate(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</p></div>
              <span className="chip bg-zinc-100 dark:bg-zinc-800">{eventStatus(e)}</span>
            </Link>
          ))
        )}
      </section>

      {blocked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Blocked people</h2>
          {blocked.map((b) => (
            <div key={b.id} className="card flex items-center justify-between p-4">
              <span className="font-medium">{b.who?.name || (b.who ? `@${b.who.username}` : "Blocked user")}</span>
              <BlockButton targetId={b.id} blocked />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
