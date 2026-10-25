import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { SpaceClient } from "@/components/c/SpaceClient";
import { Empty } from "@/components/ui/Empty";

export default async function SpacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase, user } = await getUser();
  const { data: project } = await supabase.from("projects").select("id,name,pitch,owner_id,logo_url").eq("id", projectId).single();
  const { data: member } = user
    ? await supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!project || !member || !user) {
    return (
      <Empty
        title="This Project Space is for members only"
        body="Ask the founder to accept your request, or request to join from the project page."
        action={<Link href={project ? `/p/${projectId}` : "/"} className="btn-primary">{project ? "View project" : "Go home"}</Link>}
      />
    );
  }
  return <SpaceClient project={project} userId={user.id} />;
}
