"use client";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const signOut = async () => {
    await createClient().auth.signOut();
    // Drop cached pages so the next person on this device doesn't see them.
    try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch {}
    window.location.href = "/";
  };
  return <button className="btn btn-sm bg-transparent text-zinc-400 shadow-none hover:bg-white/10 hover:text-white" onClick={signOut}>Sign out</button>;
}
