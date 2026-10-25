import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";
import { Empty } from "@/components/ui/Empty";
import { EventView } from "@/components/b/EventView";

export default async function EventPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { code: rawCode } = await params;
  const { paid } = await searchParams;
  const code = rawCode.toUpperCase();
  const { supabase, user, profile } = await getProfile();

  const { data: found } = await supabase.rpc("event_by_code", { p_code: code });
  const meta = (found as { id: string; name: string; visibility: string; can_view: boolean }[] | null)?.[0];
  if (!meta) {
    return <Empty title="Event not found" body={`No event with code ${code}. Double-check the code on the screen.`} action={<Link className="btn-primary" href="/">Try another code</Link>} />;
  }
  if (!meta.can_view) {
    return (
      <Empty
        title={`${meta.name} is invite-only`}
        body={user ? "Your account's email isn't on the guest list. Ask the organizer to invite you." : "Sign in with the email you were invited with."}
        action={!user && <Link className="btn-primary" href={`/login?next=/e/${code}`}>Sign in</Link>}
      />
    );
  }
  if (user && profile && !profile.onboarded) redirect(`/onboarding?next=/e/${code}`);

  const [{ data: event }, { data: checkin }, { data: ticket }, { data: sponsors }] = await Promise.all([
    supabase.from("events").select("*").eq("id", meta.id).single(),
    user ? supabase.from("event_checkins").select("*").eq("event_id", meta.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("event_tickets").select("status").eq("event_id", meta.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("event_sponsors").select("*").eq("event_id", meta.id).order("created_at"),
  ]);
  if (!event) return <Empty title="Event not found" />;

  return (
    <EventView
      event={event as EventRow}
      profile={profile}
      initialCheckin={checkin as { location_note: string | null } | null}
      hasTicket={ticket?.status === "paid"}
      justPaid={paid === "1"}
      sponsors={(sponsors ?? []) as { id: string; name: string; logo_url: string | null; url: string | null; tier: string }[]}
    />
  );
}
