import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEventChain } from "@/lib/admin/chains";
import { StudioAsset, StudioRoom } from "@/lib/types";
import { StudioClientLoader } from "@/components/admin/studio/StudioClientLoader";

export const dynamic = "force-dynamic";

export default async function StudioAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/admin/eventos/${id}/estudio`);
  }

  const chain = await getEventChain(id);
  if (!chain || !chain.event) notFound();

  const event = chain.event;

  // Busca ou cria o estado da sala do estúdio
  let studioRoom: StudioRoom | null = null;
  const { data: roomData } = await supabase
    .from("studio_rooms")
    .select("*")
    .eq("event_id", id)
    .maybeSingle();

  if (roomData) {
    studioRoom = roomData as StudioRoom;
  }

  // Busca os assets visuais do estúdio
  const { data: assetsData } = await supabase
    .from("studio_assets")
    .select("*")
    .eq("event_id", id)
    .order("sort_order", { ascending: true });

  const assets = (assetsData as StudioAsset[]) || [];

  return (
    <StudioClientLoader
      event={event}
      initialRoom={studioRoom}
      initialAssets={assets}
    />
  );
}
