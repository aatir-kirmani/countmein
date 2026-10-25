import Link from "next/link";
import { QrScanner } from "@/components/QrScanner";

export const metadata = { title: "Scan event QR · Countmein" };

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 pt-2">
      <div className="text-center">
        <p className="eyebrow">Doors are open</p>
        <h1 className="mt-1 text-4xl font-extrabold leading-tight">Scan the event QR</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">It&apos;s by the door, on the big screen, or on the poster.</p>
      </div>
      <QrScanner />
      <div className="flex items-center gap-3 text-xs text-zinc-500" aria-hidden>
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />no QR nearby?<span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <Link href="/#event-code" className="btn-secondary w-full">Type the 6-character code instead</Link>
    </div>
  );
}
