"use client";

import { useMemo } from "react";
import { Track } from "livekit-client";
import { AudioTrack, useParticipants } from "@livekit/components-react";

/** Volume de monitoramento local por participante (identity -> 0..2, default 1). */
export type StudioVolumeMap = Record<string, number>;

interface StudioAudioRendererProps {
  volumes?: StudioVolumeMap;
  /** Deixa o mic dos intérpretes (identity `interprete-*`) audível — só usado no Diretor, pra ele conseguir conversar com eles a qualquer momento. Nunca no Output/convidado. */
  includeInterpreters?: boolean;
}

/**
 * Substitui o `<RoomAudioRenderer/>` genérico do LiveKit por uma
 * renderização seletiva: cada participante remoto toca com o volume de
 * monitoramento escolhido no painel de configurações (StudioMediaSettings),
 * e quem está no backstage não é ouvido — defesa extra além do mute na
 * origem (`useStudioSelfStage`), útil pra saída OBS e pro caso do mute na
 * origem ainda não ter chegado via Realtime. Intérpretes de Libras nunca
 * entram nesse cálculo de palco — são audíveis só se `includeInterpreters`.
 */
export function StudioAudioRenderer({ volumes = {}, includeInterpreters = false }: StudioAudioRendererProps) {
  const participants = useParticipants();

  const audibleParticipants = useMemo(() => {
    return participants.filter((p) => {
      if (p.isLocal) return false;
      if (p.identity.startsWith("interprete-")) return includeInterpreters;
      const isDirector = p.identity.startsWith("diretor-");
      const isOnStage = isDirector
        ? p.attributes?.isOnStage !== "false"
        : p.attributes?.isOnStage === "true";
      return isOnStage;
    });
  }, [participants, includeInterpreters]);

  return (
    <>
      {audibleParticipants.map((p) => {
        const pub = p.getTrackPublication(Track.Source.Microphone);
        if (!pub) return null;
        return (
          <AudioTrack
            key={p.sid}
            trackRef={{ participant: p, source: Track.Source.Microphone, publication: pub }}
            volume={volumes[p.identity] ?? 1}
          />
        );
      })}
    </>
  );
}
