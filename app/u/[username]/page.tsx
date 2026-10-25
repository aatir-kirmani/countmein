import { notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { StageBadge } from "@/components/ui/Badges";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/a/BlockButton";
import { LINK_FIELDS, LOOKING_FOR } from "@/lib/constants";
import type { Profile, Project } from "@/lib/types";

export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,username,avatar_url,bio,skills,links,hours_per_week,looking_for,created_at")
    .eq("username", username.toLowerCase())
    .single();
  if (!profile) notFound();
  const p = profile as Profile;

  const [{ data: projects }, { data: block }] = await Promise.all([
    supabase.from("projects").select("*").eq("owner_id", p.id).order("created_at", { ascending: false }),
    user ? supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", p.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const isMe = user?.id === p.id;
  const links = LINK_FIELDS.filter((f) => p.links?.[f.key]);

  const looking = p.looking_for.map((l) => LOOKING_FOR.find((x) => x.value === l)?.label ?? l);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-30px_rgba(109,40,217,.45)] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="relative bg-brand px-6 pb-14 pt-4 text-center text-white">
          <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 text-white/10" />
          <p className="relative font-display text-xl font-extrabold uppercase tracking-wide">Hello</p>
          <p className="relative text-[10px] font-bold uppercase tracking-[0.3em] text-violet-200">my name is</p>
        </div>
        <div className="-mt-11 flex flex-col items-center gap-3 px-6 pb-6 text-center">
          <div className="relative z-10 rounded-full bg-white p-1 dark:bg-zinc-900"><Avatar src={p.avatar_url} name={p.name || p.username} size={88} /></div>
          <div>
            <h1 className="font-display text-3xl font-bold italic">{p.name || p.username}</h1>
            <p className="text-sm text-zinc-500">@{p.username}</p>
          </div>
          {p.bio && <p className="max-w-md text-zinc-700 dark:text-zinc-300">{p.bio}</p>}
          {p.skills.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {p.skills.map((sk) => <span key={sk} className="chip bg-brand-soft text-violet-900 dark:bg-violet-950 dark:text-violet-200">{sk}</span>)}
            </div>
          )}
          {(p.hours_per_week != null || looking.length > 0) && (
            <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold">
              {p.hours_per_week != null && <span className="rounded-full bg-lime-100 px-3 py-1.5 text-lime-900 dark:bg-lime-950/50 dark:text-lime-200">⏱ {p.hours_per_week} hrs/week</span>}
              {looking.map((l) => <span key={l} className="rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{l}</span>)}
            </div>
          )}
          {links.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {links.map((f) => (
                <a key={f.key} href={p.links[f.key]} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary btn-sm">{f.label} ↗</a>
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">🔒 Contact details unlock when you match on a project.</p>
          {isMe ? (
            <Link href="/me" className="btn-primary btn-sm">Edit profile</Link>
          ) : user ? (
            <div className="flex gap-2">
              <BlockButton targetId={p.id} blocked={!!block} />
              <ReportButton targetType="profile" targetId={p.id} className="btn-ghost btn-sm text-zinc-500" />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="eyebrow">Building</p>
          <h2 className="text-2xl font-extrabold">Projects</h2>
        </div>
        {(projects ?? []).length === 0 ? (
          <p className="rounded-3xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">No projects posted yet.</p>
        ) : (
          <div className="space-y-3">
            {(projects as Project[]).map((pr) => (
              <Link key={pr.id} href={`/p/${pr.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                {pr.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pr.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft font-display text-xl font-extrabold text-brand dark:bg-violet-950 dark:text-violet-300">{pr.name[0]}</span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="truncate font-bold">{pr.name}</span><StageBadge stage={pr.stage} /></div>
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{pr.pitch}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
