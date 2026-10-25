"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./Providers";
import { Sheet } from "./b/Sheet";
import { cn } from "@/lib/utils";

const REASONS = ["Spam or scam", "Harassment or hate", "Inappropriate content", "Impersonation", "Something else"];

export function ReportButton({ targetType, targetId, className = "btn-ghost text-xs" }: { targetType: "project" | "profile" | "message" | "event"; targetId: string; className?: string }) {
  const { user, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const reason = [pick, detail.trim()].filter(Boolean).join(": ");
  const submit = async () => {
    setBusy(true);
    const { error } = await createClient().from("reports").insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason });
    setBusy(false);
    if (error) toast(error.message, { kind: "error" });
    else { toast("Thanks. Our team will take a look.", { kind: "success" }); setOpen(false); setPick(""); setDetail(""); }
  };
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>Report</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Report this ${targetType}`} subtitle="Reports are private. The person won't know it was you.">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
            {REASONS.map((r) => (
              <button
                key={r} type="button" role="radio" aria-checked={pick === r} onClick={() => setPick(r)}
                className={cn("min-h-[40px] rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition",
                  pick === r ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900" : "ring-zinc-200 hover:ring-zinc-300 dark:ring-zinc-700")}
              >
                {r}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor={`rep-${targetId}`}>Anything else? <span className="text-xs font-medium text-zinc-400">optional</span></label>
            <textarea id={`rep-${targetId}`} className="input" rows={3} maxLength={900} placeholder="Add details that help us review" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
          <button className="btn-danger w-full" disabled={busy || !reason} onClick={submit}>{busy ? "Sending…" : "Send report"}</button>
        </div>
      </Sheet>
    </>
  );
}
