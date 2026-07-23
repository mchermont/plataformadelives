"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { createClient } from "@/lib/supabase/client";
import { LiveEvent, StudioAsset, StudioLayout, StudioRoom } from "@/lib/types";
import { StudioCanvas } from "./StudioCanvas";
import { StudioBackstageBar } from "./StudioBackstageBar";
import { StudioGraphicsPanel } from "./StudioGraphicsPanel";
import { StudioPrivateChat } from "./StudioPrivateChat";
import {
  User,
  LayoutGrid,
  Columns,
  Tv,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
} from "lucide-react";

interface StudioControlRoomProps {
  event: LiveEvent & { client?: { slug: string } | null };
  initialRoom: StudioRoom | null;
  initialAssets: StudioAsset[];
}

export function StudioControlRoom({ event, initialRoom, initialAssets }: StudioControlRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<StudioRoom>(
    initialRoom || {
      id: "temp",
      event_id: event.id,
      active_layout: "grid",
      active_scene_id: "default",
      spotlight_participant_id: null,
      active_banner_id: null,
      active_ticker_text: null,
      active_overlay_url: null,
      active_background_url: null,
      active_logo_url: event.brand_logo_url,
      active_presentation_id: null,
      active_slide_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
  const [assets, setAssets] = useState<StudioAsset[]>(initialAssets);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  // Mídia local de fallback quando o servidor WebRTC não está ativo
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [stageParticipants, setStageParticipants] = useState<Record<string, boolean>>({
    "diretor-local": true,
  });

  // Tenta ativar a câmera nativa do browser como fallback
  useEffect(() => {
    async function enableLocalCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Câmera local indisponível ou permissão negada:", err);
      }
    }
    enableLocalCamera();

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Busca token JWT do LiveKit na API
  useEffect(() => {
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
        console.warn("LiveKit server token indisponível, usando fallback local:", err);
      }
    }
    fetchToken();
  }, [event.id]);

  // Atualiza estado da sala no Supabase (realtime persistente)
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

  // Criar novo asset no Supabase com tratamento de erros visual
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
          alert("Não foi possível salvar o item. Verifique as permissões.");
        }
      } catch (err) {
        console.error(err);
      }
    },
    [event.id]
  );

  // Toggle do participante entre Palco e Backstage
  const handleToggleStage = useCallback(
    (participantIdentity: string, currentOnStage: boolean) => {
      setStageParticipants((prev) => ({
        ...prev,
        [participantIdentity]: !currentOnStage,
      }));
    },
    []
  );

  // Gera o link de convite correto para o convidado
  const handleCopyInviteLink = () => {
    const origin = window.location.origin;
    const clientSlug = event.client?.slug;
    const link = clientSlug
      ? `${origin}/${clientSlug}/${event.slug}/estudio`
      : `${origin}/e/${event.slug}/estudio`;

    navigator.clipboard.writeText(link);
    alert(`Link do convidado copiado para a área de transferência:\n${link}`);
  };

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
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> ESTÚDIO PRONTO
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

        {/* Canvas do Palco (com suporte a vídeo local e LiveKit) */}
        {token && serverUrl ? (
          <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect={true}
            video={isCamOn}
            audio={isMicOn}
          >
            <RoomAudioRenderer />
            <StudioCanvas roomState={roomState} assets={assets} />
          </LiveKitRoom>
        ) : (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950 shadow-2xl border border-neutral-800 flex items-center justify-center">
            {/* Fallback de Vídeo Local do Browser */}
            {stageParticipants["diretor-local"] && isCamOn ? (
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  if (el && localStream) el.srcObject = localStream;
                }}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center space-y-2 text-neutral-500">
                <User className="h-12 w-12" />
                <span className="text-xs font-semibold">Câmera desligada ou no Backstage</span>
              </div>
            )}

            {/* Tarja de Nome do Diretor */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-neutral-950/80 px-2.5 py-1 backdrop-blur-md border border-neutral-800/80">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-neutral-100">Diretor (Você)</span>
            </div>

            {/* Logo e Overlays no Fallback */}
            {roomState.active_logo_url && (
              <div className="absolute top-6 right-6 z-20 pointer-events-none max-w-[140px] max-h-[60px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={roomState.active_logo_url} alt="Logo" className="h-full w-full object-contain" />
              </div>
            )}

            {roomState.active_overlay_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={roomState.active_overlay_url} alt="Overlay" className="absolute inset-0 z-30 h-full w-full object-cover pointer-events-none" />
            )}

            {roomState.active_banner_id && (
              <div className="absolute bottom-6 left-6 z-40 max-w-xl">
                <div className="rounded-xl bg-emerald-500 p-4 text-neutral-950 shadow-2xl border border-emerald-400">
                  <h3 className="text-base font-extrabold leading-tight">
                    {assets.find((a) => a.id === roomState.active_banner_id)?.title}
                  </h3>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controles de Mídia & Seletores de Layout */}
        <div className="flex items-center justify-between rounded-2xl bg-neutral-900 border border-neutral-800 p-3">
          {/* Mutes de Áudio e Vídeo */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsMicOn(!isMicOn);
                localStream?.getAudioTracks().forEach((t) => (t.enabled = !isMicOn));
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isMicOn ? "bg-neutral-800 text-emerald-400 hover:bg-neutral-700" : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}
              title={isMicOn ? "Mutar Microfone" : "Ativar Microfone"}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            <button
              onClick={() => {
                setIsCamOn(!isCamOn);
                localStream?.getVideoTracks().forEach((t) => (t.enabled = !isCamOn));
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isCamOn ? "bg-neutral-800 text-emerald-400 hover:bg-neutral-700" : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}
              title={isCamOn ? "Desligar Câmera" : "Ligar Câmera"}
            >
              {isCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </div>

          {/* Seletores de Layout do Palco */}
          <div className="flex items-center gap-1 rounded-xl bg-neutral-950 p-1 border border-neutral-800">
            {[
              { id: "solo", label: "Solo", icon: User },
              { id: "split", label: "Split", icon: Columns },
              { id: "grid", label: "Grid", icon: LayoutGrid },
              { id: "spotlight", label: "Destaque", icon: Tv },
            ].map((layout) => {
              const Icon = layout.icon;
              const active = roomState.active_layout === layout.id;
              return (
                <button
                  key={layout.id}
                  onClick={() => handleUpdateRoom({ active_layout: layout.id as StudioLayout })}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {layout.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fila do Backstage (com suporte ao participante local do Diretor) */}
        <div className="flex flex-col space-y-2 rounded-2xl bg-neutral-900/90 border border-neutral-800 p-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Participantes do Estúdio (1)
            </span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <div
              className={`relative flex min-w-[200px] flex-col justify-between rounded-xl border p-3 transition ${
                stageParticipants["diretor-local"]
                  ? "border-emerald-500/80 bg-emerald-950/20"
                  : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-neutral-100 truncate flex items-center gap-1.5">
                    Diretor
                    <span className="rounded bg-neutral-800 px-1 py-0.5 text-[9px] font-semibold text-neutral-400">
                      Você
                    </span>
                  </p>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      stageParticipants["diretor-local"] ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {stageParticipants["diretor-local"] ? "No Palco" : "No Backstage"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleStage("diretor-local", !!stageParticipants["diretor-local"])}
                className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                  stageParticipants["diretor-local"]
                    ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                }`}
              >
                {stageParticipants["diretor-local"] ? "Mover p/ Backstage" : "Subir ao Palco"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sidebar Direita — Painel de Gráficos e GCs */}
      <div className="hidden lg:block w-80">
        <StudioGraphicsPanel
          roomState={roomState}
          assets={assets}
          onUpdateRoom={handleUpdateRoom}
          onCreateAsset={handleCreateAsset}
        />
      </div>

      {/* 4. Chat Privado da Equipe */}
      <StudioPrivateChat eventId={event.id} />
    </div>
  );
}
