"use client";

import { useParticipants } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, Star, Hand } from "lucide-react";
import { StudioParticipantTile } from "./StudioParticipantTile";
import { StudioTileGrid } from "./StudioTileGrid";

const MAX_STAGE_PARTICIPANTS = 10;

interface StudioBackstageBarProps {
  eventId: string;
  onToggleStage: (participantIdentity: string, currentOnStage: boolean) => void;
  spotlightParticipantId?: string | null;
  onSpotlight?: (participantIdentity: string) => void;
  /** Segundo destaque do arranjo "Split 2:1" — slot menor (1fr), escolhido à parte do Apresentador. */
  secondaryParticipantId?: string | null;
  onSetSecondary?: (participantIdentity: string) => void;
  /** Intérprete de Libras em exibição (overlay PIP) — separado do palco normal. */
  activeInterpreterId?: string | null;
  onSetActiveInterpreter?: (participantIdentity: string) => void;
  /** Estado otimista local — reflete o clique na hora, antes do LiveKit confirmar de verdade. */
  stageOverrides?: Record<string, boolean>;
}

export function StudioBackstageBar({
  eventId,
  onToggleStage,
  spotlightParticipantId,
  onSpotlight,
  secondaryParticipantId,
  onSetSecondary,
  activeInterpreterId,
  onSetActiveInterpreter,
  stageOverrides,
}: StudioBackstageBarProps) {
  const allParticipants = useParticipants();
  const participants = allParticipants.filter((p) => !p.identity.startsWith("interprete-"));
  const interpreters = allParticipants.filter((p) => p.identity.startsWith("interprete-"));

  const isOnStageOf = (p: (typeof participants)[0]) => {
    const override = stageOverrides?.[p.identity];
    if (override !== undefined) return override;
    // Diretor entra no palco por padrão (isOnStage !== false)
    // Convidados entram no backstage por padrão (isOnStage === true)
    const isDirector = p.identity.startsWith("diretor-");
    return isDirector ? p.attributes?.isOnStage !== "false" : p.attributes?.isOnStage === "true";
  };

  const stageCount = participants.filter(isOnStageOf).length;

  const handleToggle = (identity: string, isOnStage: boolean) => {
    if (!isOnStage && stageCount >= MAX_STAGE_PARTICIPANTS) {
      alert(`O palco já está com o máximo de ${MAX_STAGE_PARTICIPANTS} pessoas. Tire alguém antes de adicionar outra.`);
      return;
    }

    // Notifica o pai IMEDIATAMENTE (otimista) — não espera o POST voltar,
    // que passa pelo LiveKit e pode levar segundos até propagar de volta.
    onToggleStage(identity, isOnStage);

    fetch("/api/studio/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        participantIdentity: identity,
        isOnStage: !isOnStage,
      }),
    }).catch((err) => console.error("Erro ao mover participante:", err));
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-shrink-0 items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Participantes ({participants.length})
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {participants.length === 0 ? (
          <div className="py-4 text-xs text-neutral-500 italic">
            Ninguém conectado ainda. Copie o link e convide alguém!
          </div>
        ) : (
          <StudioTileGrid
            items={participants}
            getKey={(p) => p.sid}
            align="start"
            renderItem={(p, { cols }) => {
              const isOnStage = isOnStageOf(p);
              const name = p.name || p.identity;
              const isMuted = !p.isMicrophoneEnabled;
              const isCamOff = !p.isCameraEnabled;
              const isSpotlighted = p.identity === spotlightParticipantId;
              const isSecondary = p.identity === secondaryParticipantId;

              return (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggle(p.identity, isOnStage)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleToggle(p.identity, isOnStage);
                  }}
                  title={isOnStage ? "Clique para mandar pro backstage" : "Clique para subir ao palco"}
                  className={`group relative h-full w-full cursor-pointer overflow-hidden rounded-xl border transition ${
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
                    tightCrop={cols === 2}
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

                  {/* Estrela de destaque + segundo destaque (canto superior direito) */}
                  {isOnStage && (onSpotlight || onSetSecondary) && (
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                      {onSetSecondary && !isSpotlighted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetSecondary(p.identity);
                          }}
                          title="Definir como 2º destaque (Split 2:1)"
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition ${
                            isSecondary
                              ? "bg-sky-500 text-neutral-950"
                              : "bg-neutral-950/80 text-neutral-300 backdrop-blur-md hover:bg-neutral-800"
                          }`}
                        >
                          2
                        </button>
                      )}
                      {onSpotlight && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSpotlight(p.identity);
                          }}
                          title="Destacar no palco (Apresentador)"
                          className={`flex items-center justify-center rounded-full p-1 transition ${
                            isSpotlighted
                              ? "bg-emerald-500 text-neutral-950"
                              : "bg-neutral-950/80 text-neutral-300 backdrop-blur-md hover:bg-neutral-800"
                          }`}
                        >
                          <Star className={`h-3 w-3 ${isSpotlighted ? "fill-neutral-950" : ""}`} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Status palco/backstage (canto inferior esquerdo) */}
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-lg border border-neutral-800/80 bg-neutral-950/80 px-1.5 py-0.5 backdrop-blur-md">
                    <span
                      className={`block text-[8px] font-bold uppercase leading-none tracking-wider ${
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
            }}
          />
        )}
      </div>

      {interpreters.length > 0 && (
        <div className="flex-shrink-0 space-y-2 border-t border-neutral-800 pt-2">
          <span className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            <Hand className="h-3 w-3" /> Intérpretes de Libras ({interpreters.length})
          </span>
          <div className="flex flex-col gap-2">
            {interpreters.map((p) => {
              const isActive = p.identity === activeInterpreterId;
              const name = p.name || p.identity;
              return (
                <div
                  key={p.sid}
                  className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                    isActive ? "border-sky-500/80 bg-sky-950/20" : "border-neutral-800"
                  }`}
                >
                  <div className="relative aspect-video w-20 flex-shrink-0 overflow-hidden rounded-lg">
                    <StudioParticipantTile participant={p} variant="thumbnail" showName={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-neutral-100">{name}</p>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isActive ? "text-sky-400" : "text-neutral-500"
                      }`}
                    >
                      {isActive ? "● No ar" : "○ Em espera"}
                    </span>
                  </div>
                  {onSetActiveInterpreter && (
                    <button
                      onClick={() => onSetActiveInterpreter(p.identity)}
                      disabled={isActive}
                      className={`flex-shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-bold transition ${
                        isActive
                          ? "cursor-default bg-sky-500 text-neutral-950"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      {isActive ? "No ar" : "Pôr no ar"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
