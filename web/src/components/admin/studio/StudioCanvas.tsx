"use client";

import { useMemo } from "react";
import { Track } from "livekit-client";
import { VideoTrack, useParticipants } from "@livekit/components-react";
import { StudioAsset, StudioLayout, StudioRoom } from "@/lib/types";
import { User, MicOff } from "lucide-react";

interface StudioCanvasProps {
  roomState: StudioRoom;
  assets: StudioAsset[];
  onParticipantClick?: (participantId: string) => void;
}

export function StudioCanvas({ roomState, assets, onParticipantClick }: StudioCanvasProps) {
  const participants = useParticipants();

  // Filtra participantes que estão no PALCO
  const stageParticipants = useMemo(() => {
    return participants.filter((p) => {
      const isDirector = p.identity.startsWith("diretor-");
      // Diretor: fica no palco por padrão (a menos que explicitamente movido para backstage)
      if (isDirector) {
        return p.attributes?.isOnStage !== "false";
      }
      // Convidado: fica no backstage por padrão (precisa ser explicitamente colocado no palco)
      return p.attributes?.isOnStage === "true";
    });
  }, [participants]);

  const activeBanner = useMemo(() => {
    if (!roomState.active_banner_id) return null;
    return assets.find((a) => a.id === roomState.active_banner_id);
  }, [roomState.active_banner_id, assets]);

  const activePresentation = useMemo(() => {
    if (!roomState.active_presentation_id) return null;
    return assets.find((a) => a.id === roomState.active_presentation_id);
  }, [roomState.active_presentation_id, assets]);

  const activeSlideUrl = useMemo(() => {
    if (!activePresentation) return null;
    const slides = (activePresentation.content_json?.slides as string[]) || [];
    return slides[roomState.active_slide_index || 0] || null;
  }, [activePresentation, roomState.active_slide_index]);

  // Filtra os participantes a exibir com base no layout ativo (Solo foca em um)
  const displayParticipants = useMemo(() => {
    if (roomState.active_layout === "solo") {
      const spotlight = stageParticipants.find((p) => p.identity === roomState.spotlight_participant_id);
      if (spotlight) return [spotlight];
      return stageParticipants.slice(0, 1);
    }
    return stageParticipants;
  }, [stageParticipants, roomState.active_layout, roomState.spotlight_participant_id]);

  // Define a classe CSS do grid com base na quantidade de pessoas no palco
  const gridLayoutClass = useMemo(() => {
    const count = displayParticipants.length;
    const layout = roomState.active_layout;

    if (layout === "solo" || count <= 1) return "grid-cols-1 grid-rows-1";
    if (layout === "split" || count === 2) return "grid-cols-1 md:grid-cols-2 grid-rows-1";
    if (count <= 4) return "grid-cols-2 grid-rows-2";
    if (count <= 6) return "grid-cols-3 grid-rows-2";
    return "grid-cols-4 grid-rows-3";
  }, [displayParticipants.length, roomState.active_layout]);

  // Componente interno para renderizar o feed de cada palestrante
  const renderParticipantFeed = (p: typeof participants[0], isThumbnail = false) => {
    const name = p.name || p.identity;
    const isCamEnabled = p.isCameraEnabled;
    const isMicMuted = !p.isMicrophoneEnabled;
    const trackPub = p.getTrackPublication(Track.Source.Camera);

    const trackRef = {
      participant: p,
      source: Track.Source.Camera,
      publication: trackPub as any,
    };

    return (
      <div
        key={p.sid}
        onClick={() => onParticipantClick?.(p.identity)}
        className="relative h-full w-full overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center group cursor-pointer"
      >
        {isCamEnabled && trackPub?.isSubscribed ? (
          <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center space-y-2 text-neutral-500 p-2 text-center">
            <User className={isThumbnail ? "h-6 w-6" : "h-10 w-10"} />
            {!isThumbnail && (
              <span className="text-[10px] md:text-xs font-semibold text-neutral-400">
                Câmera Desligada
              </span>
            )}
          </div>
        )}

        {/* Tarja de Nome / Lower-Third */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-neutral-950/80 px-2 py-0.5 md:py-1 backdrop-blur-md border border-neutral-800/80">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] md:text-xs font-semibold text-neutral-100 truncate max-w-[120px] md:max-w-none">
            {name}
          </span>
          {isMicMuted && (
            <MicOff className="h-2.5 w-2.5 text-rose-400 ml-1.5" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 h-full w-full bg-neutral-950 flex items-center justify-center">
      {/* 1. Imagem de Fundo (Fundo de Tela) */}
      {roomState.active_background_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomState.active_background_url}
          alt="Fundo"
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      )}

      {/* 2. Grid de Vídeos ou Apresentação de Slides no Palco */}
      {activeSlideUrl ? (
        <div className="relative z-10 flex h-full w-full gap-3 p-4">
          {/* Apresentação Principal (Esquerda - 75% da largura) */}
          <div className="relative flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeSlideUrl} alt="Slide ativo" className="h-full w-full object-contain" />
          </div>

          {/* Câmeras dos Palestrantes no Palco (Direita - 25% da largura) */}
          {displayParticipants.length > 0 && (
            <div className="flex w-64 flex-col gap-2 overflow-y-auto pr-1">
              {displayParticipants.map((p) => renderParticipantFeed(p, true))}
            </div>
          )}
        </div>
      ) : displayParticipants.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="h-16 w-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 shadow-lg">
            <User className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium text-neutral-400 max-w-sm">
            O palco está vazio. Adicione participantes do backstage abaixo para ir ao ar.
          </p>
        </div>
      ) : roomState.active_layout === "spotlight" && displayParticipants.length > 1 ? (
        // Layout de Destaque: Um grande acima, outros em miniatura embaixo
        <div className="relative z-10 flex flex-col h-full w-full gap-3 p-4">
          {/* Palestrante Destaque (Foco) */}
          <div className="flex-1 min-h-0">
            {renderParticipantFeed(
              displayParticipants.find((p) => p.identity === roomState.spotlight_participant_id) || displayParticipants[0]
            )}
          </div>
          {/* Linha de Miniaturas (Thumbnails) */}
          <div className="h-28 flex gap-3 overflow-x-auto justify-center py-1">
            {displayParticipants
              .filter((p) => p.identity !== (roomState.spotlight_participant_id || displayParticipants[0].identity))
              .map((p) => (
                <div key={p.sid} className="w-40 h-full flex-shrink-0">
                  {renderParticipantFeed(p, true)}
                </div>
              ))}
          </div>
        </div>
      ) : (
        // Layout Padrão: Grid ou Split
        <div className={`relative z-10 grid h-full w-full gap-3 p-4 ${gridLayoutClass}`}>
          {displayParticipants.map((p) => renderParticipantFeed(p, false))}
        </div>
      )}

      {/* 3. Logo da Marca (Upper Right) */}
      {roomState.active_logo_url && (
        <div className="absolute top-6 right-6 z-20 pointer-events-none max-w-[140px] max-h-[60px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roomState.active_logo_url}
            alt="Logo"
            className="h-full w-full object-contain drop-shadow-md"
          />
        </div>
      )}

      {/* 4. Overlay Moldura Transparente */}
      {roomState.active_overlay_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomState.active_overlay_url}
          alt="Overlay"
          className="absolute inset-0 z-30 h-full w-full object-cover pointer-events-none"
        />
      )}

      {/* 5. GC / Banner de Texto em Destaque */}
      {activeBanner && (
        <div className="absolute bottom-6 left-6 z-40 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-xl bg-emerald-500 p-4 text-neutral-950 shadow-2xl border border-emerald-400">
            <h3 className="text-base font-extrabold leading-tight tracking-tight">
              {activeBanner.title}
            </h3>
            {activeBanner.subtitle && (
              <p className="mt-1 text-xs font-medium text-neutral-900 opacity-90">
                {activeBanner.subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
