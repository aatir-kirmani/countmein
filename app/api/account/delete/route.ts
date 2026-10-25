import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Deletes the signed-in user's account, all their rows (via ON DELETE CASCADE) and their uploaded files. */
export async function POST(req: Request) {
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createServiceClient();

  // Remove uploads under the user's folder (media/<uid>/... including nested folders).
  const removeFolder = async (prefix: string): Promise<void> => {
    const { data } = await admin.storage.from("media").list(prefix, { limit: 1000 });
    if (!data?.length) return;
    const files = data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
    const folders = data.filter((f) => !f.id).map((f) => `${prefix}/${f.name}`);
    if (files.length) await admin.storage.from("media").remove(files);
    for (const f of folders) await removeFolder(f);
  };
  try { await removeFolder(user.id); } catch { /* storage cleanup is best effort */ }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "We couldn't delete your account. Please email support." }, { status: 500 });

  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
