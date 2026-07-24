"use client";

import { Track, type Participant, type TrackPublication } from "livekit-client";
import { VideoTrack } from "@livekit/components-react";
import { MicOff, Star, User } from "lucide-react";

interface StudioParticipantTileProps {
  participant: Participant;
  /** "full" = tile grande do Canvas · "thumbnail" = miniatura do Backstage/self-preview */
  variant?: "full" | "thumbnail";
  isSpotlighted?: boolean;
  /** Esconde o selo/anel de destaque — usado na saída limpa pro OBS (sem chrome de UI) */
  showSpotlightBadge?: boolean;
  selectable?: boolean;
  onSelect?: (identity: string) => void;
  showName?: boolean;
  /** Aplica uma película cinza semi-transparente — indica visualmente "está no backstage" */
  dimmed?: boolean;
  className?: string;
}

/**
 * Tile de vídeo de um participante — usa a track de câmera já publicada no
 * LiveKit (nunca chama getUserMedia diretamente, é isso que evita o flicker
 * que a captura manual causava na tela do convidado).
 */
export function StudioParticipantTile({
  participant,
  variant = "full",
  isSpotlighted = false,
  showSpotlightBadge = true,
  selectable = false,
  onSelect,
  showName = true,
  dimmed = false,
  className = "",
}: StudioParticipantTileProps) {
  const showSpotlight = isSpotlighted && showSpotlightBadge;
  const isThumbnail = variant === "thumbnail";
  const name = participant.name || participant.identity;
  const isCamEnabled = participant.isCameraEnabled;
  const isMicMuted = !participant.isMicrophoneEnabled;
  const trackPub: TrackPublication | undefined = participant.getTrackPublication(
    Track.Source.Camera,
  );

  return (
    <div
      onClick={selectable ? () => onSelect?.(participant.identity) : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onSelect?.(participant.identity);
            }
          : undefined
      }
      className={`group relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border bg-neutral-900 transition ${
        selectable ? "cursor-pointer hover:border-neutral-600" : ""
      } ${
        showSpotlight
          ? "border-emerald-500 ring-2 ring-emerald-500/50"
          : "border-neutral-800"
      } ${className}`}
    >
      {isCamEnabled && trackPub?.isSubscribed && trackPub.track ? (
        <VideoTrack
          trackRef={{ participant, source: Track.Source.Camera, publication: trackPub }}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center space-y-1.5 p-2 text-center text-neutral-500">
          <User className={isThumbnail ? "h-5 w-5" : "h-10 w-10"} />
          {!isThumbnail && (
            <span className="text-[10px] font-semibold text-neutral-400 md:text-xs">
              Câmera Desligada
            </span>
          )}
        </div>
      )}

      {showName && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-lg border border-neutral-800/80 bg-neutral-950/80 px-1.5 py-0.5 backdrop-blur-md">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isCamEnabled ? "animate-pulse bg-emerald-400" : "bg-neutral-600"
            }`}
          />
          <span className="max-w-[100px] truncate text-[9px] font-semibold text-neutral-100 md:max-w-none md:text-xs">
            {name}
          </span>
          {isMicMuted && <MicOff className="ml-1 h-2.5 w-2.5 text-rose-400" />}
        </div>
      )}

      {dimmed && <div className="pointer-events-none absolute inset-0 bg-neutral-950/65" />}

      {showSpotlight && (
        <div className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500 p-1">
          <Star className="h-3 w-3 fill-neutral-950 text-neutral-950" />
        </div>
      )}

      {selectable && !showSpotlight && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/0 opacity-0 transition group-hover:bg-neutral-950/30 group-hover:opacity-100">
          <span className="rounded-lg bg-neutral-950/80 px-2 py-1 text-[10px] font-bold text-neutral-100">
            Destacar
          </span>
        </div>
      )}
    </div>
  );
}
