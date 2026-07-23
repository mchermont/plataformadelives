import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEventChain } from "@/lib/admin/chains";
import { StudioAsset, StudioRoom } from "@/lib/types";
import dynamic from "next/dynamic";

export const revalidate = 0;

// Carrega o StudioControlRoom APENAS no cliente — o LiveKit SDK usa APIs do browser
// que não existem no servidor (WebRTC, navigator.mediaDevices, etc.)
const StudioControlRoom = dynamic(
  () =>
    import("@/components/admin/studio/StudioControlRoom").then(
      (mod) => mod.StudioControlRoom
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-sm font-medium">Carregando Estúdio GoLive...</span>
        </div>
      </div>
    ),
  }
);

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
    <StudioControlRoom
      event={event}
      initialRoom={studioRoom}
      initialAssets={assets}
    />
  );
}
