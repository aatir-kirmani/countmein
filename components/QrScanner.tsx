"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Pull an event code out of a scanned value: a /e/CODE link or a bare 6-character code. */
export function parseEventCode(raw: string): string | null {
  const text = raw.trim();
  const fromUrl = text.match(/\/e\/([A-Za-z0-9]{6})(?:[/?#]|$)/);
  if (fromUrl) return fromUrl[1].toUpperCase();
  if (/^[A-Za-z0-9]{6}$/.test(text)) return text.toUpperCase();
  return null;
}

type DetectorLike = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Camera QR scanner. Uses the native BarcodeDetector where available (Android Chrome)
 * and falls back to jsQR on canvas frames (iOS Safari, desktop).
 */
export function QrScanner({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let detector: DetectorLike | null = null;
    let jsQR: typeof import("jsqr").default | null = null;
    let busy = false;

    const handle = (value: string) => {
      const code = parseEventCode(value);
      if (!code) {
        setHint("That QR code isn't a Countmein event. Try the one by the door.");
        return false;
      }
      stopped = true;
      setFound(code);
      navigator.vibrate?.(60);
      router.push(`/e/${code}`);
      return true;
    };

    const tick = async () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !busy) {
        busy = true;
        try {
          if (detector) {
            const codes = await detector.detect(v);
            if (codes[0] && handle(codes[0].rawValue)) return;
          } else if (jsQR && canvas.current) {
            const c = canvas.current;
            const scale = Math.min(1, 640 / v.videoWidth);
            c.width = Math.floor(v.videoWidth * scale);
            c.height = Math.floor(v.videoHeight * scale);
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, c.width, c.height);
              const img = ctx.getImageData(0, 0, c.width, c.height);
              const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
              if (res?.data && handle(res.data)) return;
            }
          }
        } catch {
          // ignore a bad frame and keep scanning
        }
        busy = false;
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Your browser can't open the camera here. Type the event code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow camera access for this site in your browser settings, or type the event code instead."
            : "We couldn't open your camera. Type the event code instead."
        );
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
      if (BD) {
        try { detector = new BD({ formats: ["qr_code"] }); } catch { detector = null; }
      }
      if (!detector) jsQR = (await import("jsqr")).default;
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
      }
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-black">
        <video ref={video} className="h-full w-full object-cover" playsInline muted aria-label="Camera preview" />
        <canvas ref={canvas} className="hidden" />
        {!error && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-3/5 w-3/5">
              {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
                <span key={c} className={`absolute h-10 w-10 border-lime-300 ${c}`} />
              ))}
              <span className="absolute inset-x-2 top-1/2 h-0.5 animate-blink bg-lime-300/80 shadow-[0_0_12px_2px_rgba(190,242,100,.7)]" />
            </div>
          </div>
        )}
        {found && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand/90 text-white">
            <p className="text-4xl" aria-hidden>🎟️</p>
            <p className="mt-2 font-display text-2xl font-extrabold">Got it: {found}</p>
            <p className="text-sm text-violet-100">Opening the event…</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-medium text-white">{error}</div>
        )}
      </div>
      <p role="status" className="mt-3 min-h-[1.25rem] text-center text-sm text-zinc-600 dark:text-zinc-400">
        {hint ?? (error ? "" : "Point your camera at the event QR code.")}
      </p>
      {onClose && (
        <button type="button" onClick={onClose} className="btn-secondary mt-2 w-full">Cancel</button>
      )}
    </div>
  );
}
