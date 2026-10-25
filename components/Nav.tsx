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
    { href: "/", label: "Home", icon: "⌂" },
    { href: "/inbox", label: "Inbox", icon: "✉", badge: pendingCount },
    { href: "/me", label: "Me", icon: "☺" },
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
                <Link href="/organizer" className="btn-ghost hidden sm:inline-flex">Organize</Link>
                <Link href="/inbox" className="btn-ghost relative hidden sm:inline-flex">
                  Inbox
                  {pendingCount > 0 && <span className="chip bg-brand text-white">{pendingCount}</span>}
                </Link>
                <Link href="/me" className="btn-ghost hidden sm:inline-flex">Me</Link>
              </>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn-primary">Sign in</Link>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      {user && (
        <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden">
          <div className="grid grid-cols-3">
            {items.map((i) => {
              const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={`relative flex h-14 flex-col items-center justify-center text-xs ${active ? "text-brand font-semibold" : "muted"}`}>
                  <span aria-hidden className="text-lg leading-none">{i.icon}</span>
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
