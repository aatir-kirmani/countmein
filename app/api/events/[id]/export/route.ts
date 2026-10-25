import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationQuestion } from "@/lib/types";

const esc = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type Prof = { name: string; username: string; skills: string[] } | null;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: event }, { data: isHost }, { data: me }] = await Promise.all([
    supabase.from("events").select("id,code,registration_questions").eq("id", id).maybeSingle(),
    supabase.rpc("is_event_organizer", { eid: id }),
    supabase.from("profiles").select("is_admin").eq("id", user.id).single(),
  ]);
  if (!event || (!isHost && !me?.is_admin)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: regs }, { data: checkins }, { data: eps }] = await Promise.all([
    supabase.from("event_registrations").select("user_id, status, answers, created_at, profile:profiles!event_registrations_user_id_fkey(name,username,skills)").eq("event_id", id).order("created_at"),
    supabase.from("event_checkins").select("user_id, checked_in_at, location_note, profile:profiles(name,username,skills)").eq("event_id", id).order("checked_in_at"),
    supabase.from("event_projects").select("project:projects(name, owner_id)").eq("event_id", id),
  ]);

  const byOwner = new Map<string, string[]>();
  for (const ep of (eps ?? []) as unknown as { project: { name: string; owner_id: string } | null }[]) {
    if (!ep.project) continue;
    byOwner.set(ep.project.owner_id, [...(byOwner.get(ep.project.owner_id) ?? []), ep.project.name]);
  }

  // One row per person: registration merged with check-in.
  type Row = { profile: Prof; status: string; registered_at: string; answers: Record<string, string>; checked_in_at: string; location_note: string };
  const people = new Map<string, Row>();
  for (const r of (regs ?? []) as unknown as { user_id: string; status: string; answers: Record<string, string> | null; created_at: string; profile: Prof }[]) {
    people.set(r.user_id, { profile: r.profile, status: r.status, registered_at: r.created_at, answers: r.answers ?? {}, checked_in_at: "", location_note: "" });
  }
  for (const c of (checkins ?? []) as unknown as { user_id: string; checked_in_at: string; location_note: string | null; profile: Prof }[]) {
    const row = people.get(c.user_id) ?? { profile: c.profile, status: "going", registered_at: c.checked_in_at, answers: {}, checked_in_at: "", location_note: "" };
    row.checked_in_at = c.checked_in_at;
    row.location_note = c.location_note ?? "";
    people.set(c.user_id, row);
  }

  const questions = (event.registration_questions ?? []) as RegistrationQuestion[];
  const rows: unknown[][] = [["name", "username", "skills", "status", "registered_at", "checked_in_at", "location_note", "projects_posted", ...questions.map((q) => q.label)]];
  for (const [userId, p] of people) {
    rows.push([
      p.profile?.name ?? "", p.profile?.username ?? "", (p.profile?.skills ?? []).join("; "),
      p.checked_in_at ? "checked_in" : p.status, p.registered_at, p.checked_in_at, p.location_note,
      (byOwner.get(userId) ?? []).join("; "),
      ...questions.map((q) => p.answers?.[q.id] ?? ""),
    ]);
  }
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="countmein-${event.code}-guests.csv"`,
    },
  });
}
