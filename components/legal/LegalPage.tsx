import Link from "next/link";
import { LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/faq", label: "FAQ" },
];

/** Shared layout for legal pages: header, table of contents, numbered sections, contact card. */
export function LegalPage({ eyebrow, title, intro, sections, current }: { eyebrow: string; title: string; intro: React.ReactNode; sections: LegalSection[]; current: string }) {
  return (
    <article className="pb-8 pt-2">
      <header className="mb-8">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-5 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">{intro}</div>
        <nav aria-label="Legal pages" className="mt-6 flex flex-wrap gap-2">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${l.href === current ? "bg-brand text-white ring-brand" : "ring-zinc-200 hover:ring-zinc-400 dark:ring-zinc-700"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <nav aria-label="On this page" className="card mb-8 p-5">
        <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">On this page</p>
        <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex gap-2 font-medium text-zinc-700 hover:text-brand dark:text-zinc-300 dark:hover:text-violet-400">
                <span className="font-mono text-xs text-zinc-400">{String(i + 1).padStart(2, "0")}</span>{s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <h2 className="flex items-baseline gap-3 text-2xl font-extrabold">
              <span className="font-mono text-sm font-bold text-brand dark:text-violet-400">{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </h2>
            <div className="legal-prose mt-3">{s.body}</div>
          </section>
        ))}
      </div>

      <aside className="mt-12 rounded-3xl bg-zinc-900 p-6 text-white dark:bg-zinc-800">
        <p className="font-display text-xl font-extrabold">Questions about this page?</p>
        <p className="mt-1 text-sm text-zinc-300">Email us and a human will reply, usually within two business days.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-accent mt-4">{SUPPORT_EMAIL}</a>
      </aside>
    </article>
  );
}
