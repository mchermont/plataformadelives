"use client";

import { useEffect, useState } from "react";
import { Check, Mic, MicOff, Video, VideoOff, Users, ArrowRight } from "lucide-react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { createClient } from "@/lib/supabase/client";
import { StudioAsset, StudioRoom } from "@/lib/types";
import { StudioCanvas } from "@/components/admin/studio/StudioCanvas";

const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then((m) => m.LiveKitRoom),
  { ssr: false }
);
const RoomAudioRenderer = dynamic(
  () => import("@livekit/components-react").then((m) => m.RoomAudioRenderer),
  { ssr: false }
);

// COMPONENTE INTERNO DO CONVIDADO (Roda dentro do LiveKitRoom)
function GuestStudioInner({
  name,
  eventId,
  initialRoom,
  initialAssets,
}: {
  name: string;
  eventId: string;
  initialRoom: StudioRoom;
  initialAssets: StudioAsset[];
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();

  const [roomState, setRoomState] = useState<StudioRoom>(initialRoom);
  const [assets, setAssets] = useState<StudioAsset[]>(initialAssets);

  // Mapeia se o participante local (convidado) está no palco ou backstage
  const isOnStage = localParticipant?.attributes?.isOnStage === "true";

  // Subscrição em Realtime com o Supabase para manter o Canvas do convidado em sincronia com o Diretor
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`studio-guest-${eventId}`)
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

  return (
    <div className="flex h-screen w-full flex-col lg:flex-row overflow-hidden bg-neutral-950 text-neutral-100 p-3 lg:p-4 gap-4">
      <RoomAudioRenderer />

      {/* Esquerda/Centro: Player de Vídeo em 16:9 (Stage) */}
      <div className="flex-1 flex flex-col justify-center items-center gap-3">
        <div className="w-full flex items-center justify-between px-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Palco da Transmissão (Ao Vivo)
          </span>
          <span className="text-[10px] text-neutral-500">
            Você está assistindo ao palco principal
          </span>
        </div>

        {/* Player Rígido 16:9 */}
        <div className="relative w-full aspect-video max-w-5xl rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800">
          <StudioCanvas roomState={roomState} assets={assets} />
        </div>
      </div>

      {/* Direita: Painel de Controle Lateral do Convidado */}
      <div className="w-full lg:w-80 flex flex-col gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex-shrink-0 justify-between">
        <div className="space-y-4">
          <div className="text-center pb-2 border-b border-neutral-800">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              isOnStage 
                ? "bg-emerald-950 border border-emerald-800 text-emerald-400" 
                : "bg-amber-950 border border-amber-800 text-amber-400"
            }`}>
              <span className={`h-2 w-2 rounded-full ${isOnStage ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              {isOnStage ? "Você está no Palco" : "Você está no Backstage"}
            </span>
            <p className="text-[11px] text-neutral-400 mt-2">
              {isOnStage 
                ? "Sua imagem e voz estão aparecendo na live!" 
                : "Aguarde. O diretor irá colocá-lo no palco em breve."}
            </p>
          </div>

          {/* Câmera Local (Preview do próprio convidado) */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 flex items-center justify-center">
            {isCameraEnabled ? (
              <video
                autoPlay
                muted
                playsInline
                ref={(el) => {
                  if (!el) return;
                  navigator.mediaDevices
                    .getUserMedia({ video: true, audio: true })
                    .then((stream) => {
                      el.srcObject = stream;
                    })
                    .catch(() => {});
                }}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-center text-neutral-500 space-y-1">
                <VideoOff className="h-8 w-8 mx-auto" />
                <span className="text-[10px] font-semibold">Câmera Desativada</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 rounded bg-neutral-950/80 px-2 py-0.5 text-[9px] font-semibold text-neutral-300">
              Sua Câmera
            </div>
          </div>

          {/* Controles de Mic e Cam */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled)}
              className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${
                isMicrophoneEnabled ? "bg-neutral-800 text-emerald-400 hover:bg-neutral-700" : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}
            >
              {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {isMicrophoneEnabled ? "Mute" : "Unmute"}
            </button>

            <button
              onClick={() => localParticipant?.setCameraEnabled(!isCameraEnabled)}
              className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${
                isCameraEnabled ? "bg-neutral-800 text-emerald-400 hover:bg-neutral-700" : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}
            >
              {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              {isCameraEnabled ? "Cam Off" : "Cam On"}
            </button>
          </div>
        </div>

        {/* Participantes na chamada */}
        <div className="border-t border-neutral-800 pt-3 space-y-2">
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-semibold px-1">
            <Users className="h-3.5 w-3.5" />
            <span>Participantes Conectados ({participants.length})</span>
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {participants.map((p) => {
              const name = p.name || p.identity;
              const isDirector = p.identity.startsWith("diretor-");
              const isGuestOnStage = isDirector
                ? p.attributes?.isOnStage !== "false"
                : p.attributes?.isOnStage === "true";

              return (
                <div key={p.sid} className="flex items-center justify-between bg-neutral-950 px-2.5 py-1.5 rounded-lg border border-neutral-800 text-[10px]">
                  <span className="font-semibold text-neutral-200 truncate max-w-[120px]">{name}</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider ${
                    isGuestOnStage ? "bg-emerald-950 text-emerald-400" : "bg-neutral-800 text-neutral-400"
                  }`}>
                    {isGuestOnStage ? "Palco" : "Aguardando"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// CARREGADOR DE CONTAINER DO CONVIDADO
export default function GuestRoomPage() {
  const params = useParams();
  const eventId = params?.id as string;

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados iniciais vindos do Supabase
  const [initialRoom, setInitialRoom] = useState<StudioRoom | null>(null);
  const [initialAssets, setInitialAssets] = useState<StudioAsset[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !eventId) return;

    setLoading(true);
    setError(null);
    try {
      const guestIdentity = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      // Busca token JWT
      const res = await fetch(
        `/api/studio/token?eventId=${eventId}&identity=${guestIdentity}&name=${encodeURIComponent(name)}`
      );
      const data = await res.json();
      
      if (data.token && data.serverUrl) {
        // Carrega dados iniciais do Supabase para o Canvas do convidado
        const supabase = createClient();
        const { data: roomData } = await supabase
          .from("studio_rooms")
          .select("*")
          .eq("event_id", eventId)
          .maybeSingle();

        const { data: assetsData } = await supabase
          .from("studio_assets")
          .select("*")
          .eq("event_id", eventId);

        setInitialRoom(roomData as StudioRoom || {
          id: "temp",
          event_id: eventId,
          active_layout: "grid",
          active_scene_id: "default",
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
        });
        
        setInitialAssets((assetsData as StudioAsset[]) || []);
        setToken(data.token);
        setServerUrl(data.serverUrl);
        setJoined(true);
      } else {
        setError(data.error || "Não foi possível entrar. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao entrar:", err);
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (joined && token && serverUrl && initialRoom) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={true}
        audio={true}
        onError={(err) => console.error("Guest LiveKit error:", err)}
        className="h-screen w-full"
      >
        <GuestStudioInner
          name={name}
          eventId={eventId}
          initialRoom={initialRoom}
          initialAssets={initialAssets}
        />
      </LiveKitRoom>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/80 p-7 shadow-2xl backdrop-blur-md">
        <div className="text-center space-y-2 mb-7">
          <span className="inline-block rounded-full bg-emerald-950 border border-emerald-800 px-3 py-1 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            🎬 Green Room
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-100">
            Entrar no Estúdio
          </h1>
          <p className="text-xs text-neutral-400">
            Digite seu nome para entrar na sala e aguardar no backstage.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Seu Nome Completo
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            ) : (
              <>
                Entrar no Backstage <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
