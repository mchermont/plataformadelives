import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudioAsset, StudioRoom } from "@/lib/types";
import { StudioOutputCanvas } from "@/components/admin/studio/StudioOutputCanvas";

export const dynamic = "force-dynamic";

export default async function StudioOutputPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Busca dados do evento
  const { data: event } = await supabase
    .from("events")
    .select("id, title, brand_logo_url, slug")
    .eq("id", id)
    .single();

  if (!event) notFound();

  // Busca estado da sala do estúdio
  const { data: roomData } = await supabase
    .from("studio_rooms")
    .select("*")
    .eq("event_id", id)
    .maybeSingle();

  // Busca assets do estúdio
  const { data: assetsData } = await supabase
    .from("studio_assets")
    .select("*")
    .eq("event_id", id);

  const roomState: StudioRoom = (roomData as StudioRoom) || {
    id: "temp",
    event_id: id,
    active_layout: "grid",
    active_scene_id: "default",
    spotlight_participant_id: null,
    secondary_participant_id: null,
    active_banner_id: null,
    active_ticker_text: null,
    active_overlay_url: null,
    active_background_url: null,
    active_logo_url: event.brand_logo_url,
    active_presentation_id: null,
    active_slide_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const assets: StudioAsset[] = (assetsData as StudioAsset[]) || [];

  return <StudioOutputCanvas eventId={id} initialRoom={roomState} initialAssets={assets} />;
}
