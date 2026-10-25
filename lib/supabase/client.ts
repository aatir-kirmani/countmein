"use client";
import { createBrowserClient } from "@supabase/ssr";
import { processLock } from "@supabase/supabase-js";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      // The default cross-tab navigator lock can stall every request if a token refresh hangs.
      // An in-process lock avoids that deadlock.
      { auth: { lock: processLock } }
    );
  }
  return client;
}
