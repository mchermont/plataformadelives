"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { LiveKitRoom, useLocalParticipant, useParticipants } from "@livekit/components-react";
import { createClient } from "@/lib/supabase/client";
import { LiveEvent, StudioAsset, StudioRoom } from "@/lib/types";
import { StudioCanvas } from "./StudioCanvas";
import { StudioBackstageBar } from "./StudioBackstageBar";
import { StudioGraphicsPanel } from "./StudioGraphicsPanel";
import { StudioPrivateChat } from "./StudioPrivateChat";
import { StudioAudioRenderer, type StudioVolumeMap } from "./StudioAudioRenderer";
import { StudioMediaSettings } from "./StudioMediaSettings";
import { useStudioSelfStage } from "./useStudioSelfStage";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  LayoutGrid,
  Columns2,
  LayoutPanelLeft,
  User,
  PanelRight,
  PanelLeft,
  PanelBottom,
  PictureInPicture,
  Settings,
} from "lucide-react";
import type { StudioLayout } from "@/lib/types";

const SCENE_OPTIONS: { layout: StudioLayout; label: string; Icon: typeof LayoutGrid }[] = [
  { layout: "grid", label: "Grid", Icon: LayoutGrid },
  { layout: "solo", label: "Solo", Icon: User },
  { layout: "split", label: "Lado a Lado", Icon: Columns2 },
  { layout: "split-2-1", label: "Split 2:1", Icon: LayoutPanelLeft },
  { layout: "thumbs-right", label: "Destaque + thumbs à direita", Icon: PanelRight },
  { layout: "thumbs-left", label: "Destaque + thumbs à esquerda", Icon: PanelLeft },
  { layout: "thumbs-bottom", label: "Destaque + thumbs embaixo", Icon: PanelBottom },
  { layout: "pip", label: "PIP (Picture-in-Picture)", Icon: PictureInPicture },
];

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
  handleCopyInviteLink,
}: {
  event: LiveEvent;
  roomState: StudioRoom;
  assets: StudioAsset[];
  handleUpdateRoom: (updates: Partial<StudioRoom>) => Promise<void>;
  handleCreateAsset: (assetData: Partial<StudioAsset>) => Promise<void>;
  handleCopyInviteLink: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const { setDesiredMicOn } = useStudioSelfStage();
  const participants = useParticipants();

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Estado otimista local de quem foi movido pro palco/backstage — reflete
  // o clique do Diretor na hora, sem esperar o round-trip até o LiveKit
  // (POST /api/studio/stage → broadcast pra todo mundo) confirmar de
  // verdade, que pode levar segundos. Some sozinho assim que o atributo
  // real do participante bater com o que foi pedido.
  const [stageOverrides, setStageOverrides] = useState<Record<string, boolean>>({});

  const handleToggleStage = useCallback((identity: string, currentOnStage: boolean) => {
    setStageOverrides((prev) => ({ ...prev, [identity]: !currentOnStage }));
  }, []);

  useEffect(() => {
    setStageOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const identity of Object.keys(prev)) {
        const p = participants.find((pp) => pp.identity === identity);
        if (!p) continue;
        const isDirector = identity.startsWith("diretor-");
        const real = isDirector ? p.attributes?.isOnStage !== "false" : p.attributes?.isOnStage === "true";
        if (real === prev[identity]) {
          delete next[identity];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [participants]);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [volumes, setVolumes] = useState<StudioVolumeMap>({});

  const toggleMic = useCallback(() => {
    setDesiredMicOn(!isMicrophoneEnabled);
  }, [setDesiredMicOn, isMicrophoneEnabled]);

  const toggleCam = useCallback(() => {
    if (localParticipant) {
      localParticipant.setCameraEnabled(!isCameraEnabled).catch(console.error);
    }
  }, [localParticipant, isCameraEnabled]);

  const handleToggleNoiseSuppression = useCallback(
    async (on: boolean) => {
      setNoiseSuppression(on);
      if (localParticipant && isMicrophoneEnabled) {
        try {
          await localParticipant.setMicrophoneEnabled(true, {
            noiseSuppression: on,
            echoCancellation: true,
            autoGainControl: true,
          });
        } catch {
          // dispositivo pode não suportar a constraint — ignora silenciosamente
        }
      }
    },
    [localParticipant, isMicrophoneEnabled],
  );

  const handleChangeVolume = useCallback((identity: string, volume: number) => {
    setVolumes((prev) => ({ ...prev, [identity]: volume }));
  }, []);

  const handleSpotlight = useCallback(
    (identity: string) => {
      handleUpdateRoom({ spotlight_participant_id: identity });
    },
    [handleUpdateRoom],
  );

  const handleSetSecondary = useCallback(
    (identity: string) => {
      handleUpdateRoom({
        secondary_participant_id: roomState.secondary_participant_id === identity ? null : identity,
      });
    },
    [handleUpdateRoom, roomState.secondary_participant_id],
  );

  const remoteTargets = useMemo(
    () =>
      participants
        .filter((p) => {
          if (p.isLocal) return false;
          const isDirector = p.identity.startsWith("diretor-");
          return isDirector ? p.attributes?.isOnStage !== "false" : p.attributes?.isOnStage === "true";
        })
        .map((p) => ({ identity: p.identity, name: p.name || p.identity })),
    [participants],
  );

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full overflow-hidden bg-neutral-950 text-neutral-100">
      <StudioAudioRenderer volumes={volumes} />

      {/* 1. Sidebar Esquerda — Status/Convite + Backstage (participantes) */}
      <div className="hidden md:flex w-[294px] flex-col overflow-hidden border-r border-neutral-800 bg-neutral-900/60 p-3 gap-3">
        <div className="flex-shrink-0 border-b border-neutral-800 pb-3">
          <button
            onClick={handleCopyInviteLink}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-800"
          >
            <Share2 className="h-3.5 w-3.5 text-emerald-400" /> Convidar Participante
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <StudioBackstageBar
            eventId={event.id}
            onToggleStage={handleToggleStage}
            spotlightParticipantId={roomState.spotlight_participant_id}
            onSpotlight={handleSpotlight}
            secondaryParticipantId={roomState.secondary_participant_id}
            onSetSecondary={handleSetSecondary}
            stageOverrides={stageOverrides}
          />
        </div>
      </div>

      {/* 2. Área Central — Canvas do Palco + Controls Bar (topo fixo, sem scroll) */}
      <div className="flex flex-1 flex-col overflow-hidden p-4 gap-2">
        {/* Player Rígido 16:9 — alinhado ao topo */}
        <div className="flex justify-center">
          <div className="relative aspect-[16/9] w-full max-w-5xl rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800">
            <StudioCanvas
              roomState={roomState}
              assets={assets}
              onParticipantClick={handleSpotlight}
              showLiveBadge
              stageOverrides={stageOverrides}
            />
          </div>
        </div>

        {/* Controls - Layouts, Microfone, Câmera */}
        <div className="mx-auto flex w-full max-w-5xl flex-shrink-0 items-center justify-between">
           <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1.5 rounded-2xl">
             {SCENE_OPTIONS.map(({ layout, label, Icon }) => (
               <button
                  key={layout}
                  onClick={() => handleUpdateRoom({ active_layout: layout })}
                  className={`p-2.5 rounded-xl transition ${roomState.active_layout === layout ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`}
                  title={label}
               >
                  <Icon className="h-4 w-4" />
               </button>
             ))}
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

           <div className="flex w-[180px] justify-end">
             <button
               onClick={() => setSettingsOpen(true)}
               className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 transition hover:bg-neutral-800"
               title="Configurações de áudio e vídeo"
             >
               <Settings className="h-4 w-4" />
             </button>
           </div>
        </div>
      </div>

      {/* 3. Sidebar Direita — Gráficos e Chat Privado */}
      <div className="thin-scroll hidden lg:flex w-96 flex-col overflow-y-auto border-l border-neutral-800 bg-neutral-900/60 p-3 space-y-4">
        <StudioGraphicsPanel
          eventId={event.id}
          roomState={roomState}
          assets={assets}
          onCreateAsset={handleCreateAsset}
          onUpdateRoom={handleUpdateRoom}
        />
        <div className="h-px w-full bg-neutral-800" />
        <StudioPrivateChat eventId={event.id} />
      </div>

      <StudioMediaSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        noiseSuppression={noiseSuppression}
        onToggleNoiseSuppression={handleToggleNoiseSuppression}
        volumes={volumes}
        onChangeVolume={handleChangeVolume}
        remoteTargets={remoteTargets}
      />
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
      secondary_participant_id: null,
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
      options={{ adaptiveStream: true, dynacast: true }}
      className="h-full w-full"
      onError={(err) => {
        console.error("LiveKit Room Connection Error:", err);
      }}
    >
      <StudioControlRoomInner
        event={event}
        roomState={roomState}
        assets={assets}
        handleUpdateRoom={handleUpdateRoom}
        handleCreateAsset={handleCreateAsset}
        handleCopyInviteLink={handleCopyInviteLink}
      />
    </LiveKitRoom>
  );
}
