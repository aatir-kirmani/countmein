import Link from "next/link";
import { DeleteAccount } from "@/components/a/DeleteAccount";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/a/ProfileEditor";
import { SignOutButton } from "@/components/a/SignOutButton";
import { BlockButton } from "@/components/a/BlockButton";
import { StageBadge } from "@/components/ui/Badges";
import { Empty } from "@/components/ui/Empty";
import { Avatar } from "@/components/ui/Avatar";
import { eventStatus, fmtDate } from "@/lib/utils";
import type { EventRow, Project } from "@/lib/types";

export default async function MePage() {
  const { supabase, user, profile } = await getProfile();
  if (!user || !profile) redirect("/login?next=/me");

  const [{ data: contact }, { data: projects }, { data: checkins }, { data: memberships }, { data: blocks }, { data: regs }] = await Promise.all([
    supabase.from("user_contacts").select("contact_email, contact_phone").eq("user_id", user.id).single(),
    supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("event_checkins").select("checked_in_at, events(*)").eq("user_id", user.id).order("checked_in_at", { ascending: false }),
    supabase.from("project_members").select("role, projects(*)").eq("user_id", user.id),
    supabase.from("blocks").select("blocked_id, profiles!blocks_blocked_id_fkey(name, username)").eq("blocker_id", user.id),
    supabase.from("event_registrations").select("status, events(*)").eq("user_id", user.id).in("status", ["going", "pending", "waitlist"]),
  ]);

  // Checked-in events plus upcoming registrations, each with the guest's status. Upcoming first (soonest), then past.
  const byId = new Map<string, { event: EventRow; tag: "checked_in" | "going" | "pending" | "waitlist" }>();
  for (const r of (regs ?? []) as { status: "going" | "pending" | "waitlist"; events: unknown }[]) {
    const ev = r.events as EventRow | null;
    if (ev) byId.set(ev.id, { event: ev, tag: r.status });
  }
  for (const c of (checkins ?? []) as { events: unknown }[]) {
    const ev = c.events as EventRow | null;
    if (ev) byId.set(ev.id, { event: ev, tag: "checked_in" });
  }
  const now = Date.now();
  const myEvents = Array.from(byId.values()).sort((a, b) => {
    const ua = new Date(a.event.ends_at).getTime() > now, ub = new Date(b.event.ends_at).getTime() > now;
    if (ua !== ub) return ua ? -1 : 1;
    const da = new Date(a.event.starts_at).getTime(), db = new Date(b.event.starts_at).getTime();
    return ua ? da - db : db - da;
  });
  const joined = (memberships ?? []).map((m: { role: string; projects: unknown }) => ({ role: m.role, project: m.projects as Project })).filter((m) => m.project && m.project.owner_id !== user.id);
  const blocked = (blocks ?? []).map((b: { blocked_id: string; profiles: unknown }) => ({ id: b.blocked_id, who: b.profiles as { name: string; username: string } | null }));

  const tiles = [
    { href: "/inbox", label: "Inbox", sub: "Requests and invites", icon: "📬", tone: "bg-sky-100 dark:bg-sky-950/50" },
    { href: "/me/projects/new", label: "New project", sub: "Post what you're building", icon: "🚀", tone: "bg-lime-100 dark:bg-lime-950/40" },
    { href: "/organizer", label: "Host events", sub: "QR codes and live board", icon: "🎤", tone: "bg-amber-100 dark:bg-amber-950/40" },
    ...(profile.is_admin ? [{ href: "/admin", label: "Admin", sub: "Reports and moderation", icon: "🛡️", tone: "bg-rose-100 dark:bg-rose-950/40" }] : []),
  ];

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white sm:p-8">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 text-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/60 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="w-fit shrink-0 rounded-full ring-4 ring-lime-300/80"><Avatar src={profile.avatar_url} name={profile.name || profile.username} size={84} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-lime-300">Your name tag</p>
            <h1 className="mt-1 truncate text-3xl font-extrabold sm:text-4xl">{profile.name || `@${profile.username}`}</h1>
            <p className="text-sm text-zinc-400">@{profile.username}{profile.bio ? ` · ${profile.bio}` : ""}</p>
            {profile.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.skills.map((sk) => <span key={sk} className="chip bg-white/10 text-white ring-1 ring-inset ring-white/15">{sk}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2">
          <Link href={`/u/${profile.username}`} className="btn-accent btn-sm">View public profile</Link>
          <a href="#profile" className="btn btn-sm bg-white/10 text-white hover:bg-white/15">Edit profile</a>
          <SignOutButton />
        </div>
      </section>

      <nav aria-label="Shortcuts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="card group p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
            <span aria-hidden className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition group-hover:rotate-[-8deg] ${t.tone}`}>{t.icon}</span>
            <p className="mt-3 font-display font-extrabold">{t.label}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.sub}</p>
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Founder</p>
            <h2 className="text-2xl font-extrabold">My projects</h2>
          </div>
          {(projects ?? []).length > 0 && <Link href="/me/projects/new" className="btn-primary btn-sm">+ New</Link>}
        </div>
        {(projects ?? []).length === 0 ? (
          <Empty emoji="🚀" title="Nothing posted yet" body="Post what you're building so people in the room can count themselves in." action={<Link href="/me/projects/new" className="btn-primary">Post your first project</Link>} />
        ) : (
          <div className="space-y-3">
            {(projects as Project[]).map((p) => (
              <div key={p.id} className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft font-display text-xl font-extrabold text-brand dark:bg-violet-950 dark:text-violet-300">{p.name[0]}</span>
                )}
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex items-center gap-2"><Link href={`/p/${p.id}`} className="min-w-0 truncate font-bold hover:underline">{p.name}</Link><StageBadge stage={p.stage} /></div>
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{p.pitch}</p>
                </div>
                <div className="ml-16 flex shrink-0 gap-1.5 sm:ml-0">
                  <Link href={`/space/${p.id}`} className="btn-secondary btn-sm">Space</Link>
                  <Link href={`/me/projects/${p.id}/edit`} className="btn-ghost btn-sm">Edit</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-10 sm:grid-cols-2 sm:gap-6">
        <section className="space-y-3">
          <div>
            <p className="eyebrow">Collaborator</p>
            <h2 className="text-2xl font-extrabold">Joined</h2>
          </div>
          {joined.length === 0 ? (
            <p className="rounded-3xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">Nothing yet. Tap <strong className="text-zinc-900 dark:text-white">Count me in</strong> on a project at your next event.</p>
          ) : (
            joined.map(({ role, project }) => (
              <Link key={project.id} href={`/space/${project.id}`} className="card flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5">
                <div className="min-w-0"><p className="truncate font-bold">{project.name}</p><p className="text-sm text-zinc-500">{role}</p></div>
                <span className="shrink-0 text-sm font-bold text-brand dark:text-violet-400">Open space →</span>
              </Link>
            ))
          )}
        </section>

        <section className="space-y-3">
          <div>
            <p className="eyebrow">Attendee</p>
            <h2 className="text-2xl font-extrabold">My events</h2>
          </div>
          {myEvents.length === 0 ? (
            <p className="rounded-3xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">No events yet. <Link href="/scan" className="font-bold text-brand underline underline-offset-4 dark:text-violet-400">Scan a QR code</Link> at your next meetup.</p>
          ) : (
            myEvents.map(({ event: e, tag }) => {
              const st = eventStatus(e);
              const chip =
                st === "cancelled" ? { label: "Cancelled", cls: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200" }
                : st === "live" ? { label: "● Live", cls: "bg-red-500 text-white" }
                : tag === "going" ? { label: "Going", cls: "bg-lime-300 text-zinc-900" }
                : tag === "pending" ? { label: "Pending", cls: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200" }
                : tag === "waitlist" ? { label: "Waitlist", cls: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200" }
                : { label: st === "ended" ? "Attended" : "Checked in", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };
              return (
                <Link key={e.id} href={`/e/${e.code}`} className="card flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5">
                  <div className="min-w-0"><p className="truncate font-bold">{e.name}</p><p className="text-xs text-zinc-500">{fmtDate(e.starts_at, e.timezone)}{e.city ? ` · ${e.city}` : ""}</p></div>
                  <span className={`chip shrink-0 ${chip.cls}`}>{chip.label}</span>
                </Link>
              );
            })
          )}
        </section>
      </div>

      <section className="space-y-4">
        <div>
          <p className="eyebrow">Settings</p>
          <h2 className="text-2xl font-extrabold">Edit profile</h2>
        </div>
        <ProfileEditor profile={profile} contact={{ contact_email: contact?.contact_email ?? "", contact_phone: contact?.contact_phone ?? "" }} />
      </section>

      {blocked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold">Blocked people</h2>
          {blocked.map((b) => (
            <div key={b.id} className="card flex items-center justify-between p-4">
              <span className="font-semibold">{b.who?.name || (b.who ? `@${b.who.username}` : "Blocked user")}</span>
              <BlockButton targetId={b.id} blocked />
            </div>
          ))}
        </section>
      )}

      <DeleteAccount />
    </div>
  );
}
