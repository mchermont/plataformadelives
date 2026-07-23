"use client";

import dynamic from "next/dynamic";
import type { LiveEvent, StudioAsset, StudioRoom } from "@/lib/types";

// Carrega o StudioControlRoom APENAS no cliente — o LiveKit SDK usa APIs do browser
// que não existem no servidor (WebRTC, navigator.mediaDevices, RTCPeerConnection etc.)
const StudioControlRoom = dynamic(
  () =>
    import("./StudioControlRoom").then((mod) => mod.StudioControlRoom),
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

interface Props {
  event: LiveEvent & { client?: { slug: string } | null };
  initialRoom: StudioRoom | null;
  initialAssets: StudioAsset[];
}

export function StudioClientLoader({ event, initialRoom, initialAssets }: Props) {
  return (
    <StudioControlRoom
      event={event}
      initialRoom={initialRoom}
      initialAssets={initialAssets}
    />
  );
}
