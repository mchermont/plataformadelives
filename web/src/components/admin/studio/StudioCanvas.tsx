"use client";

import { useMemo } from "react";
import { Track } from "livekit-client";
import { VideoTrack, useTracks, useParticipants } from "@livekit/components-react";
import { StudioAsset, StudioLayout, StudioRoom } from "@/lib/types";
import { User } from "lucide-react";

interface StudioCanvasProps {
  roomState: StudioRoom;
  assets: StudioAsset[];
  onParticipantClick?: (participantId: string) => void;
}

export function StudioCanvas({ roomState, assets, onParticipantClick }: StudioCanvasProps) {
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });

  // Filtra participantes e tracks que estão no PALCO (definido via participant.attributes.isOnStage)
  const stageTracks = useMemo(() => {
    return cameraTracks.filter((t) => {
      const p = t.participant;
      return p.attributes?.isOnStage === "true";
    });
  }, [cameraTracks]);

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

  // Define a classe CSS do grid com base no layout ativo e quantidade de pessoas no palco
  const gridLayoutClass = useMemo(() => {
    const count = stageTracks.length;
    const layout = roomState.active_layout;

    if (layout === "solo" || count <= 1) return "grid-cols-1 grid-rows-1";
    if (layout === "split" || count === 2) return "grid-cols-1 md:grid-cols-2 grid-rows-1";
    if (count <= 4) return "grid-cols-2 grid-rows-2";
    if (count <= 6) return "grid-cols-3 grid-rows-2";
    return "grid-cols-4 grid-rows-3";
  }, [stageTracks.length, roomState.active_layout]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950 shadow-2xl border border-neutral-800 flex items-center justify-center">
      {/* 1. Imagem de Fundo (Fundo de Tela) */}
      {roomState.active_background_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomState.active_background_url}
          alt="Fundo"
          className="absolute inset-0 h-full w-full object-cover"
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
          {stageTracks.length > 0 && (
            <div className="flex w-64 flex-col gap-2 overflow-y-auto">
              {stageTracks.map((track) => {
                const participant = track.participant;
                const name = participant.name || participant.identity;

                return (
                  <div
                    key={participant.sid}
                    className="relative aspect-video overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center"
                  >
                    {track.publication?.isMuted ? (
                      <User className="h-6 w-6 text-neutral-500" />
                    ) : (
                      <VideoTrack trackRef={track} className="h-full w-full object-cover" />
                    )}
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-neutral-950/80 px-2 py-0.5 backdrop-blur-md">
                      <span className="text-[10px] font-semibold text-neutral-100">{name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : stageTracks.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="h-16 w-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600">
            <User className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium text-neutral-400">
            O palco está vazio. Adicione participantes do backstage abaixo para ir ao ar.
          </p>
        </div>
      ) : (
        <div className={`relative z-10 grid h-full w-full gap-3 p-4 ${gridLayoutClass}`}>
          {stageTracks.map((track) => {
            const participant = track.participant;
            const name = participant.name || participant.identity;

            return (
              <div
                key={participant.sid}
                onClick={() => onParticipantClick?.(participant.identity)}
                className="relative overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center group cursor-pointer"
              >
                {track.publication?.isMuted ? (
                  <div className="flex flex-col items-center space-y-2 text-neutral-500">
                    <User className="h-10 w-10" />
                    <span className="text-xs font-semibold">{name} (Câmera desligada)</span>
                  </div>
                ) : (
                  <VideoTrack trackRef={track} className="h-full w-full object-cover" />
                )}

                {/* Tarja de Nome do Participante (Lower-Third Automática) */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-neutral-950/80 px-2.5 py-1 backdrop-blur-md border border-neutral-800/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold text-neutral-100">{name}</span>
                </div>
              </div>
            );
          })}
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
