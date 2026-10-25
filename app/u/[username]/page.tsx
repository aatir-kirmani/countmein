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

  return (
    <div className="space-y-6">
      <section className="card flex flex-col items-center gap-3 p-6 text-center">
        <Avatar src={p.avatar_url} name={p.name} size={88} />
        <div>
          <h1 className="text-2xl font-bold">{p.name || p.username}</h1>
          <p className="muted text-sm">@{p.username}</p>
        </div>
        {p.bio && <p className="max-w-md">{p.bio}</p>}
        {p.skills.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {p.skills.map((s) => <span key={s} className="chip bg-brand-soft text-violet-900 dark:bg-violet-950 dark:text-violet-200">{s}</span>)}
          </div>
        )}
        <p className="muted text-sm">
          {p.hours_per_week != null && <>{p.hours_per_week} hrs/week · </>}
          {p.looking_for.map((l) => LOOKING_FOR.find((x) => x.value === l)?.label ?? l).join(", ")}
        </p>
        {links.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {links.map((f) => (
              <a key={f.key} href={p.links[f.key]} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary text-xs">{f.label}</a>
            ))}
          </div>
        )}
        {isMe ? (
          <Link href="/me" className="btn-secondary">Edit profile</Link>
        ) : user ? (
          <div className="flex gap-2">
            <BlockButton targetId={p.id} blocked={!!block} />
            <ReportButton targetType="profile" targetId={p.id} className="btn-ghost text-sm" />
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Projects</h2>
        {(projects ?? []).length === 0 ? (
          <p className="muted text-sm">No projects yet.</p>
        ) : (
          (projects as Project[]).map((pr) => (
            <Link key={pr.id} href={`/p/${pr.id}`} className="card block p-4">
              <div className="flex items-center gap-2"><span className="font-semibold">{pr.name}</span><StageBadge stage={pr.stage} /></div>
              <p className="muted text-sm">{pr.pitch}</p>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
