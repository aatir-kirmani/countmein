import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/a/ProjectForm";
import { resolveEventForPosting } from "@/components/a/eventGate";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/me/projects/new${event ? `?event=${event}` : ""}`)}`);
  const ev = await resolveEventForPosting(supabase, user.id, event);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold">Post a project</h1>
        {ev && <p className="muted text-sm">It&apos;ll show up on the <strong>{ev.name}</strong> board right away.</p>}
      </div>
      <ProjectForm userId={user.id} eventCode={ev?.code ?? null} />
    </div>
  );
}
