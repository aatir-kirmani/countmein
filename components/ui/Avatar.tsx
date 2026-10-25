import { initials } from "@/lib/utils";

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700" />;
  }
  return (
    <span style={style} aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand dark:bg-violet-950 dark:text-violet-300">
      {initials(name)}
    </span>
  );
}
