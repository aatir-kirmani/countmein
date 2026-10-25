import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getProfile } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/utils";
import { PrintButton } from "@/components/c/PrintButton";
import { Poster } from "@/components/c/Poster";

/** Printable A4 door poster: big QR, event code, and how to join. */
export default async function PosterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { supabase, user, profile } = await getProfile();
  const { data: event } = await supabase.from("events").select("id,name,code,starts_at,venue,organizer_id,timezone").eq("id", eventId).maybeSingle();
  const { data: isHost } = event ? await supabase.rpc("is_event_organizer", { eid: eventId }) : { data: false };
  if (!event || !user || (!isHost && !profile?.is_admin)) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${site}/e/${event.code}`;
  const qr = await QRCode.toDataURL(url, { width: 900, margin: 1 });

  return (
    <>
      <style>{`
        .poster { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          header, nav, .no-print { display: none !important }
          main { padding: 0 !important; max-width: none !important }
          body { background: #fff !important }
          .poster { box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: none !important; min-height: calc(297mm - 24mm) !important }
          @page { size: A4; margin: 12mm }
        }
      `}</style>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Door poster</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">A4, prints in colour or black and white. Tape it at eye level by the entrance.</p>
        </div>
        <PrintButton />
      </div>
      <Poster name={event.name} code={event.code} when={fmtDate(event.starts_at, event.timezone)} venue={event.venue} qr={qr} url={url} site={site} />
    </>
  );
}
