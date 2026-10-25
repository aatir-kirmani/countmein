import Link from "next/link";
import type { ProjectWithRelations } from "@/lib/types";
import { Avatar } from "./ui/Avatar";
import { StageBadge } from "./ui/Badges";
import { openSlots } from "@/lib/utils";

export function ProjectCard({ p, eventCode }: { p: ProjectWithRelations; eventCode?: string }) {
  const slots = openSlots(p);
  return (
    <Link href={`/p/${p.id}${eventCode ? `?e=${eventCode}` : ""}`} className="card block p-4 transition hover:ring-brand active:scale-[.99]">
      <div className="flex gap-3">
        {p.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xl font-bold dark:bg-zinc-800">{p.name[0]}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{p.name}</h3>
            <StageBadge stage={p.stage} />
          </div>
          <p className="muted line-clamp-2 text-sm">{p.pitch}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm">
          <Avatar src={p.owner?.avatar_url} name={p.owner?.name ?? ""} size={24} />
          <span className="muted">{p.owner?.name}</span>
        </span>
        {p.openness === "anyone" ? (
          <span className="chip bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Open to anyone</span>
        ) : slots.length > 0 ? (
          <span className="chip bg-brand-soft text-violet-900 dark:bg-violet-950 dark:text-violet-200">
            Needs: {slots.map((s) => s.specialty).join(", ")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="card space-y-3 p-4" aria-hidden>
      <div className="flex gap-3"><div className="skeleton h-12 w-12" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-full" /></div></div>
      <div className="skeleton h-5 w-1/3" />
    </div>
  );
}
