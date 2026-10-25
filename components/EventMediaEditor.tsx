"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const MAX_EVENT_IMAGES = 11; // cover + up to 10 gallery images
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 50;

/**
 * Upload images (first one is the cover, at least one required) and one optional cover video.
 * Files go to the public "media" bucket under the organizer's folder.
 */
export function EventMediaEditor({
  userId, images, video, onChange, onBusyChange,
}: {
  userId: string; images: string[]; video: string | null;
  onChange: (v: { images: string[]; video: string | null }) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(0);
  const [videoBusy, setVideoBusy] = useState(false);
  // Latest values, so an upload that finishes late never overwrites another one.
  const latest = useRef({ images, video });
  latest.current = { images, video };
  useEffect(() => { onBusyChange?.(uploading > 0 || videoBusy); }, [uploading, videoBusy, onBusyChange]);
  const [err, setErr] = useState<string | null>(null);

  const put = async (file: File) => {
    const path = `${userId}/events/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "").slice(-40)}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  };

  const addImages = async (files: FileList) => {
    setErr(null);
    const room = MAX_EVENT_IMAGES - images.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const tooBig = picked.filter((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    const ok = picked.filter((f) => f.size <= MAX_IMAGE_MB * 1024 * 1024).slice(0, room);
    if (tooBig.length) setErr(`${tooBig.length} image(s) skipped: max ${MAX_IMAGE_MB} MB each.`);
    if (picked.length > room) setErr(`You can add up to ${MAX_EVENT_IMAGES} images.`);
    if (!ok.length) return;
    setUploading(ok.length);
    const urls: string[] = [];
    for (const f of ok) {
      try { urls.push(await put(f)); } catch (e) { setErr((e as Error).message); }
      setUploading((n) => n - 1);
    }
    onChange({ images: [...latest.current.images, ...urls], video: latest.current.video });
  };

  const addVideo = async (file: File) => {
    setErr(null);
    if (!file.type.startsWith("video/")) return setErr("Please choose a video file (MP4, MOV or WebM).");
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return setErr(`Video must be under ${MAX_VIDEO_MB} MB.`);
    setVideoBusy(true);
    try { const url = await put(file); onChange({ images: latest.current.images, video: url }); } catch (e) { setErr((e as Error).message); }
    setVideoBusy(false);
  };

  const move = (i: number, to: number) => {
    const next = [...images];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    onChange({ images: next, video });
  };

  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="label">Event photos <span className="text-brand dark:text-violet-400" aria-hidden>*</span></legend>
        <p className="hint -mt-1 mb-3">At least 1, up to {MAX_EVENT_IMAGES}. The first one is the cover. Tap ★ to change it.</p>
        {images.length === 0 && uploading === 0 ? (
          <label className="flex min-h-[176px] cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 text-center transition hover:border-brand hover:bg-violet-50/50 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-violet-950/20">
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-2xl text-white shadow-[0_3px_0_0_#4c1d95]">＋</span>
            <span className="font-bold">Add your cover photo</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB each. Pick several at once.</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) addImages(e.target.files); e.target.value = ""; }} />
          </label>
        ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, i) => (
            <div key={url} className={`group relative aspect-square overflow-hidden rounded-xl ring-2 ${i === 0 ? "ring-brand" : "ring-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={i === 0 ? "Cover image" : `Gallery image ${i}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                {i > 0 ? (
                  <button type="button" onClick={() => move(i, 0)} className="rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur" aria-label={`Make image ${i + 1} the cover`}>★ Cover</button>
                ) : <span />}
                <button type="button" onClick={() => onChange({ images: images.filter((u) => u !== url), video })} className="rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur" aria-label={`Remove image ${i + 1}`}>✕</button>
              </div>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => <div key={`u${i}`} className="skeleton aspect-square rounded-xl" aria-label="Uploading" />)}
          {images.length + uploading < MAX_EVENT_IMAGES && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 text-center text-xs font-semibold text-zinc-600 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-400">
              <span className="text-2xl" aria-hidden>＋</span>
              Add more
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) addImages(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
        )}
      </div>

      <div>
        <span className="label">Cover video <span className="text-xs font-medium text-zinc-400">optional</span></span>
        <p className="hint -mt-1 mb-3">One clip, up to {MAX_VIDEO_MB} MB. It plays muted at the top of your event page.</p>
        {video ? (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video src={video} className="aspect-video w-full object-cover" controls muted playsInline preload="metadata" />
            <button type="button" onClick={() => onChange({ images, video: null })} className="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">Remove video</button>
          </div>
        ) : (
          <label className={`flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 text-sm font-semibold text-zinc-600 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-400 ${videoBusy ? "pointer-events-none opacity-60" : ""}`}>
            <span aria-hidden>🎬</span> {videoBusy ? "Uploading video…" : "Add a cover video"}
            <input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) addVideo(e.target.files[0]); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </fieldset>
  );
}
