import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles both sign-in styles:
 * - ?code=…  PKCE (OAuth, or a magic link opened in the same browser that requested it)
 * - ?token_hash=…&type=…  email links that work in any browser (e.g. a mail app's in-app browser)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") || "email") as EmailOtpType;
  let next = url.searchParams.get("next") || "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login") || next.startsWith("/auth")) next = "/";

  const supabase = await createClient();
  let userId: string | null = null;
  let failure = url.searchParams.get("error_description");

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) failure = error.message; else userId = data.user?.id ?? null;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failure = error.message; else userId = data.user?.id ?? null;
  }

  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", userId).single();
    const dest = profile?.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(new URL(dest, url.origin));
  }

  const back = new URL("/login", url.origin);
  back.searchParams.set("error", failure || "That sign-in link didn't work.");
  if (next !== "/") back.searchParams.set("next", next);
  return NextResponse.redirect(back);
}
