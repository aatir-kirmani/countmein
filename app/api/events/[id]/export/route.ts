import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const esc = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: event }, { data: me }] = await Promise.all([
    supabase.from("events").select("id,code,organizer_id").eq("id", id).single(),
    supabase.from("profiles").select("is_admin").eq("id", user.id).single(),
  ]);
  if (!event || (event.organizer_id !== user.id && !me?.is_admin)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: checkins }, { data: eps }] = await Promise.all([
    supabase.from("event_checkins").select("user_id, checked_in_at, location_note, profile:profiles(name,username,skills)").eq("event_id", id).order("checked_in_at"),
    supabase.from("event_projects").select("project:projects(name, owner_id)").eq("event_id", id),
  ]);

  const byOwner = new Map<string, string[]>();
  for (const ep of (eps ?? []) as unknown as { project: { name: string; owner_id: string } | null }[]) {
    if (!ep.project) continue;
    byOwner.set(ep.project.owner_id, [...(byOwner.get(ep.project.owner_id) ?? []), ep.project.name]);
  }

  const rows = [["name", "username", "skills", "checked_in_at", "location_note", "projects_posted"]];
  for (const c of (checkins ?? []) as unknown as { user_id: string; checked_in_at: string; location_note: string | null; profile: { name: string; username: string; skills: string[] } | null }[]) {
    rows.push([
      c.profile?.name ?? "", c.profile?.username ?? "", (c.profile?.skills ?? []).join("; "),
      c.checked_in_at, c.location_note ?? "", (byOwner.get(c.user_id) ?? []).join("; "),
    ]);
  }
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="countmein-${event.code}-attendees.csv"`,
    },
  });
}
