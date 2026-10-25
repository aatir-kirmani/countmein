"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./Providers";

export function ReportButton({ targetType, targetId, className = "btn-ghost text-xs" }: { targetType: "project" | "profile" | "message" | "event"; targetId: string; className?: string }) {
  const { user, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!user) return null;
  const submit = async () => {
    const { error } = await createClient().from("reports").insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason });
    if (error) toast(error.message, { kind: "error" });
    else { toast("Thanks, our team will review this."); setOpen(false); setReason(""); }
  };
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>Report</button>
      {open && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">Report {targetType}</h2>
            <textarea className="input" rows={3} maxLength={1000} placeholder="What's wrong?" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-danger" disabled={!reason.trim()} onClick={submit}>Report</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
