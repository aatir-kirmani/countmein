"use client";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  return (
    <button className="btn-ghost text-sm" onClick={async () => { await createClient().auth.signOut(); window.location.href = "/"; }}>
      Sign out
    </button>
  );
}
