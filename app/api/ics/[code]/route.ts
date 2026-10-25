import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Escape text per RFC 5545 (backslash, semicolon, comma, newline).
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Lines longer than 75 octets must be folded with CRLF + space.
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
}

/** Calendar file for an event (Apple Calendar, Outlook and others). Respects event visibility via RLS. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const supabase = await createClient();
  const { data: found } = await supabase.rpc("event_by_code", { p_code: code });
  const meta = (found as { id: string; can_view: boolean }[] | null)?.[0];
  if (!meta?.can_view) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { data: e } = await supabase.from("events").select("id,name,description,starts_at,ends_at,venue,city,code,cancelled_at").eq("id", meta.id).single();
  if (!e) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const url = `${site}/e/${e.code}`;
  const location = [e.venue, e.city].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Countmein//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@countmein`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(new Date(e.starts_at))}`,
    `DTEND:${stamp(new Date(e.ends_at))}`,
    `SUMMARY:${esc(e.name)}`,
    `DESCRIPTION:${esc(`${e.description ? e.description + "\n\n" : ""}Event page: ${url}`)}`,
    ...(location ? [`LOCATION:${esc(location)}`] : []),
    `URL:${url}`,
    `STATUS:${e.cancelled_at ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(fold);

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="countmein-${e.code}.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
