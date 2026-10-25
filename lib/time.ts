// Time zone helpers. Events store UTC instants plus an IANA `timezone`; we display and edit in that zone.

const pad = (n: number) => String(n).padStart(2, "0");

/** Offset (ms) of `tz` from UTC at instant `d`. */
function offsetMs(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** "2026-10-29" + "19:00" in `tz` to a UTC Date. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle DST boundaries.
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

/** UTC instant to { date: "YYYY-MM-DD", time: "HH:MM" } in `tz`. */
export function utcToZoned(iso: string | Date, tz: string) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const z = new Date(d.getTime() + offsetMs(d, tz));
  return { date: `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())}`, time: `${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}` };
}

/** Short zone label like "GST" or "GMT+4" for `tz` at `iso`. */
export function tzLabel(iso: string | Date, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(iso)).find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

/** "Thu, Oct 29, 7:00 PM" in the event's zone. */
export function fmtInZone(iso: string, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) {
  try {
    return new Date(iso).toLocaleString(undefined, { ...opts, timeZone: tz });
  } catch {
    return new Date(iso).toLocaleString(undefined, opts);
  }
}

/** "Thu, Oct 29, 7:00 to 10:00 PM GST" style range in the event's zone. */
export function fmtRangeInZone(startIso: string, endIso: string, tz: string) {
  const day = fmtInZone(startIso, tz, { weekday: "short", month: "short", day: "numeric" });
  const t = (iso: string) => fmtInZone(iso, tz, { hour: "numeric", minute: "2-digit" });
  const sameDay = utcToZoned(startIso, tz).date === utcToZoned(endIso, tz).date;
  const end = sameDay ? t(endIso) : `${fmtInZone(endIso, tz, { weekday: "short", month: "short", day: "numeric" })}, ${t(endIso)}`;
  return `${day}, ${t(startIso)} to ${end} ${tzLabel(startIso, tz)}`;
}

export function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

/** All IANA zones the browser knows, with a few common ones first. */
export function timeZoneOptions(): string[] {
  const common = ["Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC"];
  let all: string[] = [];
  try { all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch {}
  return Array.from(new Set([...common, ...all]));
}

/** Google Calendar "add event" link. */
export function googleCalendarUrl(e: { name: string; description?: string | null; starts_at: string; ends_at: string; venue?: string | null; city?: string | null }, pageUrl: string) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.name,
    dates: `${f(e.starts_at)}/${f(e.ends_at)}`,
    details: `${e.description ? e.description + "\n\n" : ""}${pageUrl}`,
    location: [e.venue, e.city].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
