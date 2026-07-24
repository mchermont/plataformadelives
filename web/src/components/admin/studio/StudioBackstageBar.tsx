"use client";

import { useRef } from "react";
import { useParticipants } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, Star } from "lucide-react";
import { StudioParticipantTile } from "./StudioParticipantTile";
import { useFitTiles } from "./useFitTiles";

interface StudioBackstageBarProps {
  eventId: string;
  onToggleStage: (participantIdentity: string, currentOnStage: boolean) => void;
  spotlightParticipantId?: string | null;
  onSpotlight?: (participantIdentity: string) => void;
}

export function StudioBackstageBar({
  eventId,
  onToggleStage,
  spotlightParticipantId,
  onSpotlight,
}: StudioBackstageBarProps) {
  const participants = useParticipants();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fit = useFitTiles(containerRef, participants.length, { gap: 8 });

  const handleToggle = async (identity: string, isOnStage: boolean) => {
    const newStatus = !isOnStage;

    try {
      await fetch("/api/studio/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          participantIdentity: identity,
          isOnStage: newStatus,
        }),
      });
    } catch (err) {
      console.error("Erro ao mover participante:", err);
    }
    // Notifica o pai para atualização otimista
    onToggleStage(identity, isOnStage);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-shrink-0 items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Participantes ({participants.length})
        </span>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
        {participants.length === 0 ? (
          <div className="py-4 text-xs text-neutral-500 italic">
            Ninguém conectado ainda. Copie o link e convide alguém!
          </div>
        ) : fit.itemWidth === 0 ? null : (
          <div
            className="grid content-start justify-center gap-2"
            style={{ gridTemplateColumns: `repeat(${fit.cols}, ${fit.itemWidth}px)` }}
          >
            {participants.map((p) => {
            // Diretor entra no palco por padrão (isOnStage !== false)
            // Convidados entram no backstage por padrão (isOnStage === true)
            const isDirector = p.identity.startsWith("diretor-");
            const isOnStage = isDirector
              ? p.attributes?.isOnStage !== "false"
              : p.attributes?.isOnStage === "true";

            const name = p.name || p.identity;
            const isMuted = !p.isMicrophoneEnabled;
            const isCamOff = !p.isCameraEnabled;
            const isSpotlighted = p.identity === spotlightParticipantId;

            return (
              <div
                key={p.sid}
                role="button"
                tabIndex={0}
                onClick={() => handleToggle(p.identity, isOnStage)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleToggle(p.identity, isOnStage);
                }}
                title={isOnStage ? "Clique para mandar pro backstage" : "Clique para subir ao palco"}
                style={{ width: fit.itemWidth, height: fit.itemHeight }}
                className={`group relative cursor-pointer overflow-hidden rounded-xl border transition ${
                  isOnStage
                    ? "border-emerald-500/80"
                    : "border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <StudioParticipantTile
                  participant={p}
                  variant="thumbnail"
                  showName={false}
                  dimmed={!isOnStage}
                  className="border-0"
                />

                {/* Hover: dica da ação de clique */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/0 opacity-0 transition group-hover:bg-neutral-950/40 group-hover:opacity-100">
                  <span className="rounded-lg bg-neutral-950/80 px-2 py-1 text-[10px] font-bold text-neutral-100">
                    {isOnStage ? "Mandar pro Backstage" : "Subir ao Palco"}
                  </span>
                </div>

                {/* Nome + tag "Você" (canto superior esquerdo) */}
                <div className="pointer-events-none absolute left-1.5 top-1.5 flex max-w-[70%] items-center gap-1 rounded-lg border border-neutral-800/80 bg-neutral-950/80 px-1.5 py-0.5 backdrop-blur-md">
                  <span className="truncate text-[9px] font-semibold text-neutral-100">{name}</span>
                  {p.isLocal && (
                    <span className="flex-shrink-0 rounded bg-neutral-800 px-1 py-0.5 text-[8px] font-semibold text-neutral-400">
                      Você
                    </span>
                  )}
                </div>

                {/* Estrela de destaque (canto superior direito) */}
                {isOnStage && onSpotlight && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSpotlight(p.identity);
                    }}
                    title="Destacar no palco"
                    className={`absolute right-1.5 top-1.5 flex items-center justify-center rounded-full p-1 transition ${
                      isSpotlighted
                        ? "bg-emerald-500 text-neutral-950"
                        : "bg-neutral-950/80 text-neutral-300 backdrop-blur-md hover:bg-neutral-800"
                    }`}
                  >
                    <Star className={`h-3 w-3 ${isSpotlighted ? "fill-neutral-950" : ""}`} />
                  </button>
                )}

                {/* Status palco/backstage (canto inferior esquerdo) */}
                <div className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-lg border border-neutral-800/80 bg-neutral-950/80 px-1.5 py-0.5 backdrop-blur-md">
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wider ${
                      isOnStage ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {isOnStage ? "● No Palco" : "○ No Backstage"}
                  </span>
                </div>

                {/* Mic/Cam (canto inferior direito) */}
                <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-lg border border-neutral-800/80 bg-neutral-950/80 px-1.5 py-1 backdrop-blur-md">
                  {isMuted ? (
                    <MicOff className="h-3 w-3 text-rose-400" />
                  ) : (
                    <Mic className="h-3 w-3 text-emerald-400" />
                  )}
                  {isCamOff ? (
                    <VideoOff className="h-3 w-3 text-rose-400" />
                  ) : (
                    <Video className="h-3 w-3 text-emerald-400" />
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
