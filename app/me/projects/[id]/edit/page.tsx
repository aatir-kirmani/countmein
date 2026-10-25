import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/a/ProjectForm";
import type { Project, Slot } from "@/lib/types";

export default async function EditProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ event?: string }> }) {
  const { id } = await params;
  const { event } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/me/projects/${id}/edit`);
  const { data: project } = await supabase.from("projects").select("*, project_slots(*)").eq("id", id).single();
  if (!project || project.owner_id !== user.id) notFound();
  const { project_slots, ...p } = project as Project & { project_slots: Slot[] };
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Edit {p.name}</h1>
      <ProjectForm userId={user.id} project={p} slots={project_slots.sort((a, b) => a.specialty.localeCompare(b.specialty))} eventCode={event?.toUpperCase() ?? null} />
    </div>
  );
}
