import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/a/ProjectForm";
import { resolveEventForPosting } from "@/components/a/eventGate";
import { PageHeader } from "@/components/ui/Form";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/me/projects/new${event ? `?event=${event}` : ""}`)}`);
  const ev = await resolveEventForPosting(supabase, user.id, event);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={ev ? `Posting to ${ev.name}` : "New project"}
        title="Show the room what you're building"
        description={ev ? "It goes up on the live board the second you post." : "Post it once, then bring it to any event with one tap."}
      />
      <ProjectForm userId={user.id} eventCode={ev?.code ?? null} />
    </div>
  );
}
