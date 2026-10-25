/** The printable A4 poster body. Used by the poster page. */
export function Poster({ name, code, when, venue, qr, url, site }: { name: string; code: string; when: string; venue: string | null; qr: string; url: string; site: string }) {
  const host = site.replace(/^https?:\/\//, "");
  return (
    <article className="poster relative mx-auto flex aspect-[210/297] w-full max-w-[640px] flex-col rounded-3xl bg-white text-zinc-900 shadow-2xl ring-1 ring-zinc-200">
      <div className="relative overflow-hidden rounded-t-3xl bg-[#6d28d9] px-[8%] pb-[7%] pt-[6%] text-white">
        <div aria-hidden className="absolute -right-14 -top-14 h-32 w-32 rounded-full bg-[#bef264]" />
        <p className="relative font-display text-[clamp(14px,2.6vw,18px)] font-extrabold">Count<span className="text-[#d9f99d]">me</span>in ✦</p>
        <h1 className="relative mt-[4%] pr-[10%] font-display text-[clamp(30px,7.2vw,52px)] font-extrabold leading-[1.02]">
          Find your co‑founder in this room.
        </h1>
        <p className="relative mt-3 text-[clamp(12px,2.2vw,15px)] text-violet-100">
          {name} · {when}{venue ? ` · ${venue}` : ""}
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-[8%] py-[5%] text-center">
        <div className="rounded-[28px] border-[6px] border-[#6d28d9] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code for ${url}`} className="aspect-square w-[min(56vw,300px)]" />
        </div>
        <p className="mt-5 font-display text-[clamp(18px,3.6vw,26px)] font-extrabold">Point your camera here</p>
        <p className="mt-1 text-[clamp(11px,2vw,14px)] text-zinc-600">or open <strong className="text-zinc-900">{host}</strong> and type</p>
        <div className="mt-3 flex gap-[1.5%]" aria-label={`Event code ${code}`}>
          {code.split("").map((ch, i) => (
            <span key={i} aria-hidden className="flex aspect-[4/5] w-[clamp(34px,7vw,52px)] items-center justify-center rounded-xl bg-zinc-900 font-mono text-[clamp(20px,4.4vw,32px)] font-bold text-white">{ch}</span>
          ))}
        </div>
      </div>
      <ol className="grid grid-cols-3 border-t-2 border-dashed border-zinc-200 text-left text-[clamp(10px,1.9vw,13px)]">
        {[["Check in", "Scan and sign in. 30 seconds."], ["Post", "Share what you're building."], ["Count me in", "Tap to join a project."]].map(([t, b], i) => (
          <li key={t} className="flex gap-2 px-[5%] py-[5%] [&:not(:first-child)]:border-l-2 [&:not(:first-child)]:border-dashed [&:not(:first-child)]:border-zinc-200">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#bef264] font-display text-xs font-extrabold">{i + 1}</span>
            <span><strong className="block">{t}</strong><span className="text-zinc-600">{b}</span></span>
          </li>
        ))}
      </ol>
    </article>
  );
}
