"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" },
  { href: "/organizer", label: "Host", icon: "M12 3v4M5.6 5.6l2.8 2.8M3 12h4M18.4 5.6l-2.8 2.8M21 12h-4M8 21l4-9 4 9M9.5 17.5h5" },
  { href: "/scan", label: "Scan", icon: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" },
  { href: "/inbox", label: "Inbox", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
  { href: "/me", label: "Me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" },
] as const;

function NavIcon({ d, className = "h-[22px] w-[22px]", bold }: { d: string; className?: string; bold?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={bold ? 2.4 : 1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Badge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime-300 px-1 text-[10px] font-black tabular-nums text-zinc-900 ring-2 ring-white dark:ring-zinc-950", className)}>
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function Nav() {
  const { user, pendingCount } = useApp();
  const path = usePathname();
  if (path.endsWith("/board")) return null; // projector view is full-screen

  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/80 print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight" aria-label="Countmein home">
            Count<span className="text-brand dark:text-violet-400">me</span>in<span aria-hidden className="ml-0.5 inline-block text-lime-500">✦</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            {user ? (
              <div className="mr-1 hidden items-center gap-0.5 rounded-2xl bg-zinc-100/80 p-1 sm:flex dark:bg-zinc-900/80">
                {ITEMS.filter((i) => i.href !== "/").map((i) => {
                  const active = isActive(i.href);
                  return (
                    <Link
                      key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition",
                        active ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      )}
                    >
                      <NavIcon d={i.icon} className="h-4 w-4" bold={active} />
                      {i.label}
                      {i.href === "/inbox" && <Badge n={pendingCount} className="ring-zinc-100 dark:ring-zinc-900" />}
                    </Link>
                  );
                })}
              </div>
            ) : path.startsWith("/login") || path.startsWith("/auth") ? null : (
              <Link href={path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`} className="btn-primary btn-sm">Sign in</Link>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {user && (
        <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/90 sm:hidden print:hidden">
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
            {ITEMS.map((i) => {
              const active = isActive(i.href);
              if (i.href === "/scan") {
                return (
                  <Link key={i.href} href={i.href} aria-label="Scan event QR code" aria-current={active ? "page" : undefined} className="flex justify-center">
                    <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-300 text-zinc-900 shadow-[0_4px_0_0_#4d7c0f] ring-4 ring-white transition active:translate-y-0.5 active:shadow-[0_1px_0_0_#4d7c0f] dark:ring-zinc-950">
                      <NavIcon d={i.icon} className="h-6 w-6" bold />
                    </span>
                  </Link>
                );
              }
              return (
                <Link
                  key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                  className={cn("relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition", active ? "text-brand dark:text-violet-300" : "text-zinc-500 dark:text-zinc-400")}
                >
                  <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition", active && "bg-violet-100 dark:bg-violet-950/70")}>
                    <NavIcon d={i.icon} bold={active} />
                  </span>
                  {i.label}
                  {i.href === "/inbox" && <Badge n={pendingCount} className="absolute left-1/2 top-1.5 ml-2" />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
