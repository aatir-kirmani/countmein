import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { InboxView } from "@/components/b/InboxView";

export const metadata = { title: "Inbox · Countmein" };

export default async function InboxPage() {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/inbox");
  return <InboxView userId={user.id} />;
}
