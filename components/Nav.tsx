"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  const { user, pendingCount } = useApp();
  const path = usePathname();
  if (path.endsWith("/board")) return null; // projector view is full-screen

  const items = [
    { href: "/", label: "Home", icon: "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" },
    { href: "/scan", label: "Scan", icon: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" },
    { href: "/organizer", label: "Host", icon: "M12 3v4M5.6 5.6l2.8 2.8M3 12h4M18.4 5.6l-2.8 2.8M21 12h-4M8 21l4-9 4 9M9.5 17.5h5" },
    { href: "/inbox", label: "Inbox", icon: "M4 6h16v12H4zM4 7l8 6 8-6", badge: pendingCount },
    { href: "/me", label: "Me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight">
            Count<span className="text-brand dark:text-violet-400">me</span>in<span aria-hidden className="ml-0.5 inline-block text-lime-500">✦</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            {user ? (
              <>
                <Link href="/scan" className="btn-ghost hidden sm:inline-flex">Scan</Link>
                <Link href="/organizer" className="btn-ghost hidden sm:inline-flex">Host</Link>
                <Link href="/inbox" className="btn-ghost relative hidden sm:inline-flex">
                  Inbox
                  {pendingCount > 0 && <span className="chip bg-brand text-white">{pendingCount}</span>}
                </Link>
                <Link href="/me" className="btn-ghost hidden sm:inline-flex">Me</Link>
              </>
            ) : path.startsWith("/login") || path.startsWith("/auth") ? null : (
              <Link href={path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`} className="btn-primary">Sign in</Link>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      {user && (
        <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden">
          <div className="grid grid-cols-5">
            {items.map((i) => {
              const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={`relative flex h-14 flex-col items-center justify-center text-xs ${active ? "text-brand font-semibold" : "muted"}`}>
                  <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d={i.icon} /></svg>
                  {i.label}
                  {!!i.badge && <span className="absolute right-1/4 top-1.5 chip bg-brand px-1.5 py-0 text-[10px] text-white">{i.badge}</span>}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
