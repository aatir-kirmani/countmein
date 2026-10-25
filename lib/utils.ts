import type { EventRow, ProjectWithRelations } from "./types";
import { COMPENSATION, STAGES } from "./constants";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function eventStatus(e: Pick<EventRow, "status" | "starts_at" | "ends_at">) {
  const now = Date.now();
  if (e.status === "ended" || now >= new Date(e.ends_at).getTime()) return "ended";
  if (e.status === "live" || now >= new Date(e.starts_at).getTime()) return "live";
  return "upcoming";
}

export function stageLabel(s: string) {
  return STAGES.find((x) => x.value === s)?.label ?? s;
}

export function compLabel(c: string) {
  return COMPENSATION.find((x) => x.value === c)?.label ?? c;
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
}

export function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function openSlots(p: ProjectWithRelations) {
  return (p.project_slots ?? []).filter((s) => s.status === "open");
}

/** Does this project need any of the viewer's skills? "Open to anyone" always matches. */
export function needsMySkills(p: ProjectWithRelations, skills: string[]) {
  if (p.openness === "anyone") return true;
  if (p.openness !== "specific") return false;
  const mine = new Set(skills.map((s) => s.toLowerCase()));
  return openSlots(p).some((s) => mine.has(s.specialty.toLowerCase()));
}

export function initials(name: string) {
  return (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const MAP_HOSTS = /^(www\.)?(google\.[a-z.]+|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl)$/i;

/** True for Google Maps share links (maps.app.goo.gl, goo.gl/maps, google.com/maps, maps.google.com). */
export function isGoogleMapsUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || !MAP_HOSTS.test(u.hostname)) return false;
    if (/^(www\.)?google\./i.test(u.hostname)) return u.pathname.startsWith("/maps");
    if (/^goo\.gl$/i.test(u.hostname)) return u.pathname.startsWith("/maps");
    return true;
  } catch {
    return false;
  }
}

/** Where "Get directions" should go: the organizer's map link, or a Maps search for the venue. */
export function directionsHref(e: { maps_url?: string | null; venue?: string | null; city?: string | null }) {
  if (e.maps_url) return e.maps_url;
  const q = [e.venue, e.city].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
