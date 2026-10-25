import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/a/ProjectForm";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const { user } = await getUser();
  if (!user) redirect("/login?next=/me/projects/new");
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Post a project</h1>
      <ProjectForm userId={user.id} eventCode={event?.toUpperCase() ?? null} />
    </div>
  );
}
