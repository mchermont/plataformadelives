import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LiveEvent } from "@/lib/types";
import { LiveControlRoom } from "@/components/admin/LiveControlRoom";

export const dynamic = "force-dynamic";

export default async function DiretorDeLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: event }, { data: profile }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single<LiveEvent>(),
    supabase
      .from("profiles")
      .select("is_platform_admin, full_name")
      .eq("id", user?.id ?? "")
      .single(),
  ]);
  if (!event) notFound();

  return (
    <LiveControlRoom
      initialEvent={event}
      userId={user!.id}
      userName={profile?.full_name || "Equipe"}
      isAdmin={profile?.is_platform_admin ?? false}
    />
  );
}
