"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { createClient } from "@/lib/supabase/client";
import { StudioAsset, StudioRoom } from "@/lib/types";
import { StudioCanvas } from "./StudioCanvas";

interface StudioOutputCanvasProps {
  eventId: string;
  initialRoom: StudioRoom;
  initialAssets: StudioAsset[];
}

export function StudioOutputCanvas({ eventId, initialRoom, initialAssets }: StudioOutputCanvasProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<StudioRoom>(initialRoom);
  const [assets, setAssets] = useState<StudioAsset[]>(initialAssets);

  // Busca token de espectador de saída
  useEffect(() => {
    async function fetchToken() {
      try {
        const outputIdentity = `output-${Math.random().toString(36).substring(2, 8)}`;
        const res = await fetch(`/api/studio/token?eventId=${eventId}&identity=${outputIdentity}&name=Output`);
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          setServerUrl(data.serverUrl);
        }
      } catch (err) {
        console.error("Erro ao buscar token do output:", err);
      }
    }
    fetchToken();
  }, [eventId]);

  // Subscrição em Realtime para refletir mudanças do estúdio instantaneamente no Output
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`studio-output-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_rooms", filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (payload.new) {
            setRoomState(payload.new as StudioRoom);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_assets", filter: `event_id=eq.${eventId}` },
        async () => {
          const { data } = await supabase.from("studio_assets").select("*").eq("event_id", eventId);
          if (data) setAssets(data as StudioAsset[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (!token || !serverUrl) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-neutral-500 text-xs font-mono">
        Carregando saída de vídeo do Estúdio GoLive...
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={false}
      audio={false}
      className="h-screen w-screen bg-black overflow-hidden flex items-center justify-center p-0 m-0"
    >
      <RoomAudioRenderer />
      <div className="relative aspect-video w-full max-w-[1920px] bg-black">
        <StudioCanvas roomState={roomState} assets={assets} />
      </div>
    </LiveKitRoom>
  );
}
