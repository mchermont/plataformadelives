"use client";

import { useEffect, useState, useCallback } from "react";
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from "@livekit/components-react";
import { createClient } from "@/lib/supabase/client";
import { LiveEvent, StudioAsset, StudioRoom } from "@/lib/types";
import { StudioCanvas } from "./StudioCanvas";
import { StudioBackstageBar } from "./StudioBackstageBar";
import { StudioGraphicsPanel } from "./StudioGraphicsPanel";
import { StudioPrivateChat } from "./StudioPrivateChat";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  LayoutGrid,
  Columns,
  User,
  Tv,
} from "lucide-react";

interface StudioControlRoomProps {
  event: LiveEvent & { client?: { slug: string } | null };
  initialRoom: StudioRoom | null;
  initialAssets: StudioAsset[];
}

function StudioControlRoomInner({
  event,
  roomState,
  assets,
  handleUpdateRoom,
  handleCreateAsset,
  handleToggleStage,
  handleCopyInviteLink,
}: {
  event: LiveEvent;
  roomState: StudioRoom;
  assets: StudioAsset[];
  handleUpdateRoom: (updates: Partial<StudioRoom>) => Promise<void>;
  handleCreateAsset: (assetData: Partial<StudioAsset>) => Promise<void>;
  handleToggleStage: (identity: string, currentOnStage: boolean) => void;
  handleCopyInviteLink: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const toggleMic = useCallback(() => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(console.error);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCam = useCallback(() => {
    if (localParticipant) {
      localParticipant.setCameraEnabled(!isCameraEnabled).catch(console.error);
    }
  }, [localParticipant, isCameraEnabled]);

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full overflow-hidden bg-neutral-950 text-neutral-100">
      {/* 1. Sidebar Esquerda — Cenas pré-configuradas */}
      <div className="hidden md:flex w-52 flex-col border-r border-neutral-800 bg-neutral-900/60 p-3 space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1">
          Cenas do Estúdio
        </span>
        <div className="space-y-2">
          <button
            onClick={() => handleUpdateRoom({ active_scene_id: "default", active_layout: "grid" })}
            className={`w-full rounded-xl border p-2.5 text-left transition ${
              roomState.active_scene_id === "default"
                ? "border-emerald-500 bg-emerald-950/20"
                : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
            }`}
          >
            <span className="text-xs font-bold text-neutral-200 block">Principal</span>
            <span className="text-[10px] text-neutral-400">Layout em Grid</span>
          </button>

          <button
            onClick={() => handleUpdateRoom({ active_scene_id: "interview", active_layout: "split" })}
            className={`w-full rounded-xl border p-2.5 text-left transition ${
              roomState.active_scene_id === "interview"
                ? "border-emerald-500 bg-emerald-950/20"
                : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
            }`}
          >
            <span className="text-xs font-bold text-neutral-200 block">Entrevista</span>
            <span className="text-[10px] text-neutral-400">Lado a Lado</span>
          </button>
        </div>
      </div>

      {/* 2. Área Central — Canvas do Palco + Controls Bar + Backstage Bar */}
      <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
        {/* Top Header Status */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 px-3 py-1 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> ESTÚDIO AO VIVO
            </span>
            <span className="text-xs font-semibold text-neutral-400">{event.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyInviteLink}
              className="flex items-center gap-1.5 rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-800"
            >
              <Share2 className="h-3.5 w-3.5 text-emerald-400" /> Convidar Participante
            </button>
          </div>
        </div>

        {/* Player Rígido 16:9 */}
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="relative w-full aspect-video max-w-5xl rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800">
            <StudioCanvas roomState={roomState} assets={assets} />
          </div>
        </div>

        {/* Controls - Layouts, Microfone, Câmera */}
        <div className="flex items-center justify-between pt-2">
           <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1.5 rounded-2xl">
             <button
                onClick={() => handleUpdateRoom({ active_layout: "solo" })}
                className={`p-2.5 rounded-xl transition ${roomState.active_layout === "solo" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`}
                title="Solo"
             >
                <User className="h-4 w-4" />
             </button>
             <button
                onClick={() => handleUpdateRoom({ active_layout: "split" })}
                className={`p-2.5 rounded-xl transition ${roomState.active_layout === "split" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`}
                title="Lado a Lado"
             >
                <Columns className="h-4 w-4" />
             </button>
             <button
                onClick={() => handleUpdateRoom({ active_layout: "grid" })}
                className={`p-2.5 rounded-xl transition ${roomState.active_layout === "grid" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`}
                title="Grid"
             >
                <LayoutGrid className="h-4 w-4" />
             </button>
             <button
                onClick={() => handleUpdateRoom({ active_layout: "spotlight" })}
                className={`p-2.5 rounded-xl transition ${roomState.active_layout === "spotlight" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`}
                title="Destaque (Spotlight)"
             >
                <Tv className="h-4 w-4" />
             </button>
           </div>

           <div className="flex items-center gap-4">
             <button
               onClick={toggleMic}
               className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isMicrophoneEnabled ? "bg-neutral-800 hover:bg-neutral-700" : "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50"}`}
             >
               {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
             </button>
             <button
               onClick={toggleCam}
               className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isCameraEnabled ? "bg-neutral-800 hover:bg-neutral-700" : "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50"}`}
             >
               {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
             </button>
           </div>
           
           <div className="w-[180px]"></div> {/* spacer for centering */}
        </div>

        {/* Backstage Bar - Lista de Participantes */}
        <StudioBackstageBar
          eventId={event.id}
          onToggleStage={handleToggleStage}
        />
      </div>

      {/* 3. Sidebar Direita — Gráficos e Chat Privado */}
      <div className="hidden lg:flex w-72 flex-col border-l border-neutral-800 bg-neutral-900/60 p-3 space-y-4">
        <StudioGraphicsPanel
          roomState={roomState}
          assets={assets}
          onCreateAsset={handleCreateAsset}
          onUpdateRoom={handleUpdateRoom}
        />
        <div className="h-px w-full bg-neutral-800" />
        <StudioPrivateChat eventId={event.id} />
      </div>
    </div>
  );
}

export function StudioControlRoom({
  event,
  initialRoom,
  initialAssets,
}: StudioControlRoomProps) {
  const [roomState, setRoomState] = useState<StudioRoom>(
    initialRoom || {
      id: "temp",
      event_id: event.id,
      active_scene_id: "default",
      active_layout: "grid",
      spotlight_participant_id: null,
      active_banner_id: null,
      active_ticker_text: null,
      active_overlay_url: null,
      active_background_url: null,
      active_logo_url: null,
      active_presentation_id: null,
      active_slide_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
  const [assets, setAssets] = useState<StudioAsset[]>(initialAssets || []);
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function fetchToken() {
      try {
        const res = await fetch(
          `/api/studio/token?eventId=${event.id}&identity=diretor-${event.id}&name=Diretor&isDirector=true`
        );
        const data = await res.json();
        if (data.token && data.serverUrl) {
          setToken(data.token);
          setServerUrl(data.serverUrl);
        }
      } catch (err) {
        console.warn("LiveKit server token indisponível:", err);
      }
    }
    fetchToken();
  }, [event.id]);

  useEffect(() => {
    if (!mounted) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`studio-director-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_rooms", filter: `event_id=eq.${event.id}` },
        (payload) => {
          if (payload.new) {
            setRoomState(payload.new as StudioRoom);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_assets", filter: `event_id=eq.${event.id}` },
        async () => {
          const { data } = await supabase.from("studio_assets").select("*").eq("event_id", event.id);
          if (data) setAssets(data as StudioAsset[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, mounted]);

  const handleUpdateRoom = useCallback(
    async (updates: Partial<StudioRoom>) => {
      setRoomState((prev) => ({ ...prev, ...updates }));
      try {
        const supabase = createClient();
        await supabase.from("studio_rooms").upsert(
          {
            event_id: event.id,
            ...updates,
          },
          { onConflict: "event_id" }
        );
      } catch (err) {
        console.error("Erro ao atualizar studio_rooms:", err);
      }
    },
    [event.id]
  );

  const handleCreateAsset = useCallback(
    async (assetData: Partial<StudioAsset>) => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("studio_assets")
          .insert({
            event_id: event.id,
            ...assetData,
          })
          .select()
          .single();

        if (data && !error) {
          setAssets((prev) => [data as StudioAsset, ...prev]);
        } else if (error) {
          console.error("Erro ao salvar asset:", error);
          alert("Não foi possível salvar o item.");
        }
      } catch (err) {
        console.error(err);
      }
    },
    [event.id]
  );

  const handleToggleStage = useCallback((participantIdentity: string, currentOnStage: boolean) => {
    // This is optimistically handled in StudioBackstageBar, but we could do more here if needed
    console.log("Toggle stage:", participantIdentity, currentOnStage);
  }, []);

  const handleCopyInviteLink = () => {
    const origin = window.location.origin;
    const link = `${origin}/estudio/${event.id}/guest`;
    navigator.clipboard.writeText(link);
    alert(`Link copiado!\n\nCompartilhe com o convidado:\n${link}`);
  };

  const spinner = (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-950 text-neutral-400">
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="text-sm font-medium">Carregando Estúdio GoLive...</span>
      </div>
    </div>
  );

  if (!mounted) return spinner;
  if (!token || !serverUrl) return spinner;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      className="h-full w-full"
      onError={(err) => {
        console.error("LiveKit Room Connection Error:", err);
      }}
    >
      <RoomAudioRenderer />
      <StudioControlRoomInner
        event={event}
        roomState={roomState}
        assets={assets}
        handleUpdateRoom={handleUpdateRoom}
        handleCreateAsset={handleCreateAsset}
        handleToggleStage={handleToggleStage}
        handleCopyInviteLink={handleCopyInviteLink}
      />
    </LiveKitRoom>
  );
}
