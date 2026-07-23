"use client";

import { useParticipants } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, ArrowUp, ArrowDown, Shield } from "lucide-react";

interface StudioBackstageBarProps {
  onToggleStage: (participantIdentity: string, currentOnStage: boolean) => void;
}

export function StudioBackstageBar({ onToggleStage }: StudioBackstageBarProps) {
  const participants = useParticipants();

  return (
    <div className="flex flex-col space-y-2 rounded-2xl bg-neutral-900/90 border border-neutral-800 p-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          Participantes & Backstage ({participants.length})
        </span>
        <span className="text-[11px] text-neutral-500">
          Clique no botão para mover o participante para o palco
        </span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {participants.length === 0 ? (
          <div className="py-4 text-xs text-neutral-500 italic">
            Nenhum participante conectado no momento.
          </div>
        ) : (
          participants.map((p) => {
            const isOnStage = p.attributes?.isOnStage !== "false";
            const name = p.name || p.identity;
            const isMuted = !p.isMicrophoneEnabled;
            const isCamOff = !p.isCameraEnabled;

            return (
              <div
                key={p.sid}
                className={`relative flex min-w-[200px] flex-col justify-between rounded-xl border p-3 transition ${
                  isOnStage
                    ? "border-emerald-500/80 bg-emerald-950/20"
                    : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-neutral-100 truncate flex items-center gap-1.5">
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
                      {isOnStage ? "No Palco" : "No Backstage"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
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

                <button
                  onClick={() => {
                    const newStatus = isOnStage ? "false" : "true";
                    if (p.isLocal) {
                      (p as unknown as { setAttributes: (attr: Record<string, string>) => void }).setAttributes?.({ isOnStage: newStatus });
                    } else {
                      onToggleStage(p.identity, isOnStage);
                    }
                  }}
                  className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                    isOnStage
                      ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                  }`}
                >
                  {isOnStage ? (
                    <>
                      <ArrowDown className="h-3.5 w-3.5" /> Mover p/ Backstage
                    </>
                  ) : (
                    <>
                      <ArrowUp className="h-3.5 w-3.5" /> Subir ao Palco
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
