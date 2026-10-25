import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { EventForm } from "@/components/c/EventForm";
import { PageHeader } from "@/components/ui/Form";

export default async function NewEventPage() {
  const { supabase, user } = await getUser();
  const { data: series } = await supabase.from("event_series").select("id,name").eq("organizer_id", user!.id);
  return (
    <div>
      <Link href="/organizer" className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
        <span aria-hidden>←</span> Your events
      </Link>
      <PageHeader
        eyebrow="New event"
        title="Let's set up the room"
        description="A few details and a photo. You'll get a door code, a QR poster and a live board as soon as you save."
      />
      <EventForm userId={user!.id} series={series ?? []} />
    </div>
  );
}
