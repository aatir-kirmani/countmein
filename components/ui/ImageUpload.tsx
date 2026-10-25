"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Uploads to the public "media" bucket under the user's folder and returns a public URL. */
export function ImageUpload({
  value, onChange, label = "Image", userId, shape = "square", hint,
}: { value: string | null; onChange: (url: string | null) => void; label?: string; userId: string; shape?: "square" | "round"; hint?: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return setErr("That file is over 5 MB. Try a smaller one.");
    setBusy(true); setErr(null);
    const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false });
    if (error) setErr(error.message);
    else onChange(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
    setBusy(false);
  };

  const radius = shape === "round" ? "rounded-full" : "rounded-2xl";
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-4">
        <label className={`group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden ${radius} bg-zinc-100 border-2 border-dashed border-zinc-300 transition hover:border-brand dark:bg-zinc-900 dark:border-zinc-700`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="text-2xl text-zinc-400 transition group-hover:scale-110 group-hover:text-brand">＋</span>
          )}
          {busy && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">…</span>}
          <input type="file" accept="image/*" className="sr-only" aria-label={`Upload ${label.toLowerCase()}`} onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ""; }} />
        </label>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary btn-sm cursor-pointer">
              {busy ? "Uploading…" : value ? "Replace" : "Choose image"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ""; }} />
            </label>
            {value && <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => onChange(null)}>Remove</button>}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint ?? "PNG or JPG, up to 5 MB"}</p>
        </div>
      </div>
      {err && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
    </div>
  );
}
