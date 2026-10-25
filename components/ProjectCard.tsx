import Link from "next/link";
import type { ProjectWithRelations } from "@/lib/types";
import { Avatar } from "./ui/Avatar";
import { StageBadge } from "./ui/Badges";
import { compLabel, openSlots } from "@/lib/utils";
import { ProjectLogo } from "./b/ui";

export function ProjectCard({ p, eventCode, highlight }: { p: ProjectWithRelations; eventCode?: string; highlight?: boolean }) {
  const slots = openSlots(p);
  const shown = slots.slice(0, 3);
  return (
    <Link
      href={`/p/${p.id}${eventCode ? `?e=${eventCode}` : ""}`}
      className={`group relative flex h-full flex-col rounded-3xl bg-white p-4 ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(109,40,217,.35)] active:translate-y-0 dark:bg-zinc-900 sm:p-5 ${
        highlight ? "ring-2 ring-brand dark:ring-violet-400" : "ring-zinc-200/80 hover:ring-violet-300 dark:ring-zinc-800 dark:hover:ring-violet-500/60"
      }`}
    >
      <div className="flex gap-3.5">
        <ProjectLogo name={p.name} url={p.logo_url} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-lg font-extrabold leading-tight">{p.name}</h3>
            <StageBadge stage={p.stage} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-600 dark:text-zinc-400">{p.pitch}</p>
        </div>
      </div>

      {(p.openness === "anyone" || shown.length > 0) && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {p.openness === "anyone" ? (
            <span className="chip bg-lime-200 text-lime-950 dark:bg-lime-300/90">🙌 Open to anyone</span>
          ) : (
            <>
              {shown.map((s) => (
                <span key={s.id} className="chip bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200">
                  {s.specialty}
                  <span className="font-medium opacity-60">· {compLabel(s.compensation)}</span>
                </span>
              ))}
              {slots.length > shown.length && <span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">+{slots.length - shown.length} more</span>}
            </>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Avatar src={p.owner?.avatar_url} name={p.owner?.name ?? ""} size={26} />
          <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{p.owner?.name}</span>
        </span>
        {highlight ? (
          <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">Your project</span>
        ) : p.openness !== "closed" && (slots.length > 0 || p.openness === "anyone") ? (
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand transition group-hover:gap-2 dark:text-violet-300">
            Count me in <span aria-hidden>→</span>
          </span>
        ) : (
          <span className="shrink-0 text-xs font-medium text-zinc-500">Just showing</span>
        )}
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800" aria-hidden>
      <div className="flex gap-3.5">
        <div className="skeleton h-[52px] w-[52px] rounded-2xl" />
        <div className="flex-1 space-y-2 pt-1"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-2/3" /></div>
      </div>
      <div className="mt-4 flex gap-2"><div className="skeleton h-6 w-24 rounded-full" /><div className="skeleton h-6 w-20 rounded-full" /></div>
      <div className="mt-4 flex justify-between"><div className="skeleton h-6 w-28 rounded-full" /><div className="skeleton h-5 w-24" /></div>
    </div>
  );
}
