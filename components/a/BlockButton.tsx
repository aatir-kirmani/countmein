"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/Providers";

export function BlockButton({ targetId, blocked: initial }: { targetId: string; blocked: boolean }) {
  const { user, toast } = useApp();
  const router = useRouter();
  const [blocked, setBlocked] = useState(initial);
  if (!user) return null;
  const toggle = async () => {
    const supabase = createClient();
    if (!blocked && !confirm("Block this person? They won't be able to send you requests or see your projects.")) return;
    const { error } = blocked
      ? await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", targetId)
      : await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: targetId });
    if (error) return toast(error.message, { kind: "error" });
    setBlocked(!blocked);
    toast(blocked ? "Unblocked" : "Blocked. You can unblock them from your profile.");
    // Blocking hides their profile from you too, so leave their page.
    if (!blocked && window.location.pathname.startsWith("/u/")) router.push("/me");
    else router.refresh();
  };
  return <button className="btn-ghost text-sm" onClick={toggle}>{blocked ? "Unblock" : "Block"}</button>;
}
