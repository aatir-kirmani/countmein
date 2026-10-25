import { getUser } from "@/lib/supabase/server";
import { EventForm } from "@/components/c/EventForm";

export default async function NewEventPage() {
  const { supabase, user } = await getUser();
  const { data: series } = await supabase.from("event_series").select("id,name").eq("organizer_id", user!.id);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New event</h1>
      <EventForm userId={user!.id} series={series ?? []} />
    </div>
  );
}
