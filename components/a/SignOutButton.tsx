"use client";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const signOut = async () => {
    await createClient().auth.signOut();
    // Drop cached pages so the next person on this device doesn't see them.
    try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch {}
    window.location.href = "/";
  };
  return <button className="btn-ghost text-sm" onClick={signOut}>Sign out</button>;
}
