import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import type { EventRow, RegistrationStatus } from "@/lib/types";
import type { HostPerson, PublicStats } from "@/components/b/Registration";
import { EmptyState } from "@/components/b/ui";
import { EventView } from "@/components/b/EventView";

export default async function EventPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ paid?: string; ticket?: string; checkin?: string }> }) {
  const { code: rawCode } = await params;
  const { paid, ticket: ticketParam, checkin: checkinParam } = await searchParams;
  const code = rawCode.toUpperCase();
  const { supabase, user, profile } = await getProfile();

  const { data: found } = await supabase.rpc("event_by_code", { p_code: code });
  const meta = (found as { id: string; name: string; visibility: string; can_view: boolean }[] | null)?.[0];
  if (!meta) {
    return (
      <EmptyState emoji="🎟️" title="Hmm, that code doesn't ring a bell" className="mt-8"
        body={<>No event with code <b className="font-mono">{code}</b>. Double-check the code on the screen or the poster.</>}
        action={<div className="flex gap-2"><Link className="btn-primary" href="/">Try another code</Link><Link className="btn-secondary" href="/scan">Scan QR</Link></div>} />
    );
  }
  if (!meta.can_view) {
    return (
      <EmptyState
        emoji="💌" className="mt-8"
        title={`${meta.name} is invite-only`}
        body={user ? "Your account's email isn't on the guest list. Ask the organizer to invite you." : "Sign in with the email you were invited with."}
        action={!user && <Link className="btn-primary" href={`/login?next=/e/${code}`}>Sign in</Link>}
      />
    );
  }
  if (user && profile && !profile.onboarded) redirect(`/onboarding?next=/e/${code}`);

  const [{ data: event }, { data: checkin }, { data: ticket }, { data: sponsors }, { data: registration }, { data: cohosts }, { data: statsRows }] = await Promise.all([
    supabase.from("events").select("*").eq("id", meta.id).single(),
    user ? supabase.from("event_checkins").select("*").eq("event_id", meta.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("event_tickets").select("status").eq("event_id", meta.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("event_sponsors").select("*").eq("event_id", meta.id).order("created_at"),
    user ? supabase.from("event_registrations").select("status").eq("event_id", meta.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("event_hosts").select("user_id, role, show_on_page, profile:profiles(id,name,username,avatar_url)").eq("event_id", meta.id).order("created_at"),
    supabase.rpc("event_public_stats", { p_event: meta.id }),
  ]);
  if (!event) return <EmptyState emoji="🎟️" title="Event not found" className="mt-8" />;

  // Owner first, then co-hosts who chose to appear on the page.
  const { data: owner } = await supabase.from("profiles").select("id,name,username,avatar_url").eq("id", event.organizer_id).maybeSingle();
  type HostRow = { user_id: string; role: "cohost" | "manager"; show_on_page: boolean; profile: { id: string; name: string; username: string; avatar_url: string | null } | null };
  const hostRows = (cohosts ?? []) as unknown as HostRow[];
  const hosts: HostPerson[] = [
    ...(owner ? [{ ...owner, role: "owner" as const }] : []),
    ...hostRows.filter((h) => h.show_on_page && h.profile).map((h) => ({ ...h.profile!, role: h.role })),
  ];
  const isHost = !!user && (event.organizer_id === user.id || hostRows.some((h) => h.user_id === user.id));
  const stats = ((statsRows as PublicStats[] | null)?.[0] ?? null);

  return (
    <EventView
      event={event as EventRow}
      profile={profile}
      initialCheckin={checkin as { location_note: string | null } | null}
      hasTicket={ticket?.status === "paid"}
      justPaid={paid === "1" || ticketParam === "success"}
      highlightCheckin={checkinParam === "1"}
      initialRegistration={(registration?.status as RegistrationStatus | undefined) ?? null}
      hosts={hosts}
      isHost={isHost}
      initialStats={stats}
      sponsors={(sponsors ?? []) as { id: string; name: string; logo_url: string | null; url: string | null; tier: string }[]}
    />
  );
}
