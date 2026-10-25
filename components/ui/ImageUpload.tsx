"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Uploads to the public "media" bucket under the user's folder and returns a public URL. */
export function ImageUpload({ value, onChange, label = "Image", userId }: { value: string | null; onChange: (url: string | null) => void; label?: string; userId: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return setErr("Max 5 MB");
    setBusy(true); setErr(null);
    const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false });
    if (error) setErr(error.message);
    else onChange(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
    setBusy(false);
  };

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-700" />
        )}
        <label className="btn-secondary cursor-pointer">
          {busy ? "Uploading…" : value ? "Change" : "Upload"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {value && <button type="button" className="btn-ghost" onClick={() => onChange(null)}>Remove</button>}
      </div>
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
    </div>
  );
}
