import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import type { Profile, ProjectWithRelations } from "@/lib/types";
import { eventStatus } from "@/lib/utils";
import { ProjectDetail } from "@/components/b/ProjectDetail";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ e?: string }> }) {
  const { projectId } = await params;
  const { e } = await searchParams;
  const { supabase, user } = await getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("*, owner:profiles!projects_owner_id_fkey(id,name,username,avatar_url,skills,bio,links), project_slots(*)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role, profile:profiles(id,name,username,avatar_url)")
    .eq("project_id", projectId)
    .order("joined_at");

  // Which event context applies to a request: ?e=CODE, else a live event where I'm checked in and this project is shown.
  let eventCtx: { id: string; code: string; ended: boolean } | null = null;
  const { data: eps } = await supabase.from("event_projects").select("event:events(id,code,status,starts_at,ends_at)").eq("project_id", projectId);
  const events = ((eps ?? []) as unknown as { event: { id: string; code: string; status: "upcoming" | "live" | "ended"; starts_at: string; ends_at: string } | null }[])
    .map((x) => x.event).filter(Boolean) as { id: string; code: string; status: "upcoming" | "live" | "ended"; starts_at: string; ends_at: string }[];
  if (user) {
    const { data: mine } = await supabase.from("event_checkins").select("event_id").eq("user_id", user.id).in("event_id", events.map((x) => x.id));
    const checked = new Set((mine ?? []).map((m: { event_id: string }) => m.event_id));
    const pick = (e ? events.find((x) => x.code === e.toUpperCase() && checked.has(x.id)) : null)
      ?? events.find((x) => checked.has(x.id) && eventStatus(x) !== "ended");
    if (pick) eventCtx = { id: pick.id, code: pick.code, ended: eventStatus(pick) === "ended" };
  }

  let myProfile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    myProfile = data as Profile | null;
  }

  return (
    <ProjectDetail
      project={project as ProjectWithRelations & { owner: ProjectWithRelations["owner"] & Pick<Profile, "bio" | "links"> }}
      members={(members ?? []) as unknown as { user_id: string; role: string; profile: Pick<Profile, "id" | "name" | "username" | "avatar_url"> }[]}
      me={myProfile}
      eventCtx={eventCtx}
      backCode={e?.toUpperCase() ?? null}
    />
  );
}
