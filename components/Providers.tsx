"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

type Toast = { id: number; text: string; href?: string; kind?: "info" | "success" | "error" };
type Ctx = {
  user: User | null;
  toast: (text: string, opts?: { href?: string; kind?: Toast["kind"] }) => void;
  pendingCount: number;
  refreshPending: () => void;
};

const AppCtx = createContext<Ctx>({ user: null, toast: () => {}, pendingCount: 0, refreshPending: () => {} });
export const useApp = () => useContext(AppCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const onboardedFor = useRef<string | null>(null);

  const toast = useCallback((text: string, opts?: { href?: string; kind?: Toast["kind"] }) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e: AuthChangeEvent, s: Session | null) => setUser(s?.user ?? null));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Count of items needing my response: requests to my projects + invites to me.
  const refreshPending = useCallback(async () => {
    if (!user) return setPendingCount(0);
    const { data: mine } = await supabase.from("projects").select("id").eq("owner_id", user.id);
    const ids = (mine ?? []).map((p: { id: string }) => p.id);
    const [a, b] = await Promise.all([
      ids.length
        ? supabase.from("join_requests").select("id", { count: "exact", head: true })
            .in("project_id", ids).eq("direction", "request").eq("status", "pending")
        : Promise.resolve({ count: 0 }),
      supabase.from("join_requests").select("id", { count: "exact", head: true })
        .eq("requester_id", user.id).eq("direction", "invite").eq("status", "pending"),
    ]);
    setPendingCount((a.count ?? 0) + (b.count ?? 0));
  }, [supabase, user]);

  useEffect(() => {
    if (!user || onboardedFor.current === user.id) return;
    if (["/onboarding", "/login", "/auth"].some((p) => path.startsWith(p)) || path.endsWith("/board")) return;
    supabase.from("profiles").select("onboarded").eq("id", user.id).single().then(({ data }: { data: { onboarded: boolean } | null }) => {
      if (data?.onboarded) onboardedFor.current = user.id;
      else if (data) router.replace(`/onboarding?next=${encodeURIComponent(path)}`);
    });
  }, [supabase, user, path, router]);

  // Realtime notifications + presence heartbeat (used to decide whether to email).
  useEffect(() => {
    if (!user) return;
    refreshPending();
    supabase.rpc("touch_last_seen");
    const beat = setInterval(() => supabase.rpc("touch_last_seen"), 60_000);
    const ch = supabase
      .channel(`notify:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, (payload: { eventType: string; new: Record<string, unknown> }) => {
        const r = payload.new as { requester_id?: string; direction?: string; status?: string };
        refreshPending();
        const mine = r.requester_id === user.id;
        if (payload.eventType === "INSERT") {
          if (r.direction === "invite" && mine) toast("You've been invited to a project!", { href: "/inbox", kind: "success" });
          else if (r.direction === "request" && !mine) toast("New “Count me in” request!", { href: "/inbox", kind: "success" });
        } else if (payload.eventType === "UPDATE") {
          if (r.direction === "request" && mine) {
            if (r.status === "accepted") toast("🎉 Your request was accepted!", { href: "/inbox", kind: "success" });
            else if (r.status === "interested") toast("The founder wants to talk first. Check your inbox.", { href: "/inbox" });
            else if (r.status === "declined") toast("A request was declined", { href: "/inbox" });
          } else if (r.direction === "invite" && !mine) {
            if (r.status === "accepted") toast("🎉 Your invite was accepted!", { href: "/inbox", kind: "success" });
            else if (r.status === "declined") toast("An invite was declined", { href: "/inbox" });
          }
        }
      })
      .subscribe();
    return () => { clearInterval(beat); supabase.removeChannel(ch); };
  }, [supabase, user, toast, refreshPending]);

  return (
    <AppCtx.Provider value={{ user, toast, pendingCount, refreshPending }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <a
            key={t.id}
            href={t.href}
            className={`pointer-events-auto w-full max-w-sm animate-pop rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.kind === "error" ? "bg-red-600 text-white" : t.kind === "success" ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            }`}
          >
            {t.text}
          </a>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
