"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_SELECT } from "@/lib/constants";
import type { Profile, ProjectWithRelations } from "@/lib/types";

export type Attendee = {
  user_id: string;
  location_note: string | null;
  checked_in_at: string;
  profile: Pick<Profile, "id" | "name" | "username" | "avatar_url" | "bio" | "skills" | "looking_for">;
};

/** Loads projects + attendees for an event and keeps them fresh via Realtime (debounced refetch). */
export function useEventData(eventId: string, enabled: boolean) {
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectWithRelations[] | null>(null);
  const [people, setPeople] = useState<Attendee[] | null>(null);
  const timers = useRef<{ p?: ReturnType<typeof setTimeout>; a?: ReturnType<typeof setTimeout> }>({});

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from("event_projects")
      .select(`added_at, project:projects(${PROJECT_SELECT})`)
      .eq("event_id", eventId)
      .order("added_at", { ascending: false });
    setProjects(((data ?? []) as unknown as { project: ProjectWithRelations | null }[]).map((r) => r.project).filter(Boolean) as ProjectWithRelations[]);
  }, [supabase, eventId]);

  const loadPeople = useCallback(async () => {
    const { data } = await supabase
      .from("event_checkins")
      .select("user_id, location_note, checked_in_at, profile:profiles(id,name,username,avatar_url,bio,skills,looking_for)")
      .eq("event_id", eventId)
      .order("checked_in_at", { ascending: false });
    setPeople(((data ?? []) as unknown as Attendee[]).filter((a) => a.profile));
  }, [supabase, eventId]);

  useEffect(() => {
    if (!enabled) return;
    loadProjects();
    loadPeople();
    const t = timers.current;
    const debounced = (key: "p" | "a", fn: () => void) => () => {
      clearTimeout(t[key]);
      t[key] = setTimeout(fn, 400);
    };
    const refP = debounced("p", loadProjects);
    const refA = debounced("a", loadPeople);
    const ch = supabase
      .channel(`event:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_projects", filter: `event_id=eq.${eventId}` }, refP)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_slots" }, refP)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects" }, refP)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_checkins", filter: `event_id=eq.${eventId}` }, () => { refA(); refP(); })
      .subscribe();
    return () => {
      clearTimeout(t.p); clearTimeout(t.a);
      supabase.removeChannel(ch);
    };
  }, [supabase, eventId, enabled, loadProjects, loadPeople]);

  return { projects, people, reload: () => { loadProjects(); loadPeople(); } };
}
