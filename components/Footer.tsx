"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SUPPORT_EMAIL } from "@/lib/site";

export function Footer() {
  const path = usePathname();
  if (path.endsWith("/board") || path.endsWith("/poster")) return null;
  return (
    <footer className="border-t border-zinc-200 pb-24 pt-8 print:hidden dark:border-zinc-800 sm:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display font-extrabold">
          Count<span className="text-brand dark:text-violet-400">me</span>in<span className="ml-0.5 text-lime-500" aria-hidden>✦</span>
          <span className="ml-2 font-sans text-xs font-normal text-zinc-500">Free for everyone right now.</span>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-zinc-600 dark:text-zinc-400">
          <Link href="/faq" className="hover:text-zinc-900 dark:hover:text-white">FAQ</Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">Privacy</Link>
          <Link href="/refunds" className="hover:text-zinc-900 dark:hover:text-white">Refunds</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-zinc-900 dark:hover:text-white">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
