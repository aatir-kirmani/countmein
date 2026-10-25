import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { SpaceClient } from "@/components/c/SpaceClient";

export default async function SpacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase, user } = await getUser();
  const { data: project } = await supabase.from("projects").select("id,name,pitch,owner_id,logo_url").eq("id", projectId).single();
  const { data: member } = user
    ? await supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!project || !member || !user) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <p className="text-5xl" aria-hidden>🔐</p>
        <h1 className="mt-4 text-3xl font-extrabold">Members only, sorry!</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          This is the team&apos;s private space. Ask the founder to accept your request, or tap Count me in on the project page.
        </p>
        <Link href={project ? `/p/${projectId}` : "/"} className="btn-primary mt-6">{project ? "View the project" : "Go home"}</Link>
      </div>
    );
  }
  return <SpaceClient project={project} userId={user.id} />;
}
