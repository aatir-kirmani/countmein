export function Empty({ title, body, action, emoji = "✨" }: { title: string; body?: string; action?: React.ReactNode; emoji?: string }) {
  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
      <span aria-hidden className="flex h-14 w-14 rotate-[-6deg] items-center justify-center rounded-2xl bg-lime-200 text-2xl shadow-[0_4px_0_0_#65a30d] dark:bg-lime-300">{emoji}</span>
      <p className="mt-2 font-display text-lg font-extrabold">{title}</p>
      {body && <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
