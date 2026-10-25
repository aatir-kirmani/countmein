import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getProfile } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/utils";
import { PrintButton } from "@/components/c/PrintButton";

/** Printable A4 door poster: big QR, event code, and how to join. */
export default async function PosterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { supabase, user, profile } = await getProfile();
  const { data: event } = await supabase.from("events").select("id,name,code,starts_at,venue,organizer_id").eq("id", eventId).single();
  if (!event || (event.organizer_id !== user?.id && !profile?.is_admin)) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${site}/e/${event.code}`;
  const qr = await QRCode.toDataURL(url, { width: 900, margin: 1 });

  return (
    <>
      <style>{`@media print { header, nav, .no-print { display: none !important } main { padding: 0 !important; max-width: none !important } body { background: #fff !important } @page { size: A4; margin: 12mm } }`}</style>
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <article className="mx-auto flex max-w-[680px] flex-col items-center rounded-3xl bg-white p-10 text-center text-zinc-900 ring-1 ring-zinc-200 print:ring-0">
        <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-violet-700">Countmein ✦</p>
        <h1 className="mt-4 text-5xl font-extrabold leading-tight">Find your next collaborator in this room</h1>
        <p className="mt-3 text-lg text-zinc-600">{event.name} · {fmtDate(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${url}`} className="mt-8 w-[380px] max-w-full" />
        <p className="mt-6 text-xl font-semibold">Scan with your phone camera</p>
        <p className="mt-2 text-zinc-600">or go to <strong>{site.replace(/^https?:\/\//, "")}</strong> and enter</p>
        <p className="mt-3 rounded-2xl bg-violet-700 px-8 py-3 font-mono text-5xl font-black tracking-[0.25em] text-white">{event.code}</p>
        <ol className="mt-8 grid w-full grid-cols-3 gap-4 text-sm">
          <li><strong className="block text-2xl">1</strong>Check in</li>
          <li><strong className="block text-2xl">2</strong>Post what you&apos;re building</li>
          <li><strong className="block text-2xl">3</strong>Tap &ldquo;Count me in&rdquo;</li>
        </ol>
      </article>
    </>
  );
}
