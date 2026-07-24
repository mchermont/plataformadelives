"use client";

import { useParticipants } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, ArrowUp, ArrowDown, Star } from "lucide-react";
import { StudioParticipantTile } from "./StudioParticipantTile";

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Participantes ({participants.length})
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {participants.length === 0 ? (
          <div className="py-4 text-xs text-neutral-500 italic">
            Ninguém conectado ainda. Copie o link e convide alguém!
          </div>
        ) : (
          participants.map((p) => {
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
                className={`flex w-full flex-col rounded-xl border p-2 transition ${
                  isOnStage
                    ? "border-emerald-500/80 bg-emerald-950/20"
                    : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                }`}
              >
                <div className="relative mb-2 aspect-video w-full flex-shrink-0 overflow-hidden rounded-lg">
                  <StudioParticipantTile
                    participant={p}
                    variant="thumbnail"
                    showName={false}
                    dimmed={!isOnStage}
                  />
                </div>

                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 pr-1">
                    <p className="flex items-center gap-1.5 truncate text-xs font-bold text-neutral-100">
                      {name}
                      {p.isLocal && (
                        <span className="rounded bg-neutral-800 px-1 py-0.5 text-[9px] font-semibold text-neutral-400">
                          Você
                        </span>
                      )}
                    </p>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isOnStage ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {isOnStage ? "● No Palco" : "○ No Backstage"}
                    </span>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1">
                    {isMuted ? (
                      <MicOff className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    {isCamOff ? (
                      <VideoOff className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Video className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggle(p.identity, isOnStage)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                      isOnStage
                        ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                        : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                    }`}
                  >
                    {isOnStage ? (
                      <>
                        <ArrowDown className="h-3.5 w-3.5" /> Backstage
                      </>
                    ) : (
                      <>
                        <ArrowUp className="h-3.5 w-3.5" /> Subir
                      </>
                    )}
                  </button>

                  {isOnStage && onSpotlight && (
                    <button
                      onClick={() => onSpotlight(p.identity)}
                      title="Destacar no palco"
                      className={`flex items-center justify-center rounded-lg p-1.5 transition ${
                        isSpotlighted
                          ? "bg-emerald-500 text-neutral-950"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      <Star className={`h-3.5 w-3.5 ${isSpotlighted ? "fill-neutral-950" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
