import Link from "next/link";
import { QrScanner } from "@/components/QrScanner";

export const metadata = { title: "Scan event QR · Countmein" };

export default function ScanPage() {
  return (
    <div className="space-y-5 pt-2">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold">Scan the event QR</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">You&apos;ll find it by the door or on the big screen.</p>
      </div>
      <QrScanner />
      <p className="text-center text-sm">
        No QR code nearby?{" "}
        <Link href="/#event-code" className="font-semibold text-brand underline underline-offset-4 dark:text-violet-400">Type the code instead</Link>
      </p>
    </div>
  );
}
