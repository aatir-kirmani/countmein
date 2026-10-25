import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/a/ProjectForm";
import type { Project, Slot } from "@/lib/types";
import { resolveEventForPosting } from "@/components/a/eventGate";
import { PageHeader } from "@/components/ui/Form";

export default async function EditProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ event?: string }> }) {
  const { id } = await params;
  const { event } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/me/projects/${id}/edit`);
  const { data: project } = await supabase.from("projects").select("*, project_slots(*)").eq("id", id).single();
  if (!project || project.owner_id !== user.id) notFound();
  const { project_slots, ...p } = project as Project & { project_slots: Slot[] };
  const ev = await resolveEventForPosting(supabase, user.id, event);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Edit project" title={p.name} description="Changes show up on every board right away." />
      <ProjectForm userId={user.id} project={p} slots={[...project_slots].sort((a, b) => a.specialty.localeCompare(b.specialty))} eventCode={ev?.code ?? null} />
    </div>
  );
}
