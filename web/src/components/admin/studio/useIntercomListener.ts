"use client";

import { useEffect, useState } from "react";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { Track, TrackEvent } from "livekit-client";
import type { StudioRoom } from "@/lib/types";

const INTERCOM_TRACK_NAME = "intercom";
export const INTERCOM_ALL = "__all__";

/**
 * Lado de quem PODE ser o alvo do intercom (convidado/intérprete). Acha a
 * track de intercom do Diretor (nome, não fonte — a fonte é `Unknown`,
 * inespecífica) e só considera "sendo chamado" se `intercom_target_id`
 * bater com a própria identity ou for "Todos". O aviso "Diretor falando"
 * sai do estado de mute da própria track (instantâneo, sem Supabase).
 *
 * Não usa `useTrackMutedIndicator` (do @livekit/components-react): esse
 * hook lança erro em vez de retornar estado vazio quando a track ainda
 * não existe (ela só é publicada no primeiro PTT do Diretor) — derrubava
 * a página inteira do convidado/intérprete assim que entrava na sala,
 * antes de qualquer intercom acontecer. Por isso o mute é acompanhado à
 * mão via os eventos nativos da publicação.
 */
export function useIntercomListener(roomState: StudioRoom) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const director = participants.find((p) => p.identity.startsWith("diretor-"));
  const pub = director?.getTrackPublicationByName(INTERCOM_TRACK_NAME);

  const [isMuted, setIsMuted] = useState(pub?.isMuted ?? true);

  useEffect(() => {
    if (!pub) {
      setIsMuted(true);
      return;
    }
    setIsMuted(pub.isMuted);
    const onMuted = () => setIsMuted(true);
    const onUnmuted = () => setIsMuted(false);
    pub.on(TrackEvent.Muted, onMuted);
    pub.on(TrackEvent.Unmuted, onUnmuted);
    return () => {
      pub.off(TrackEvent.Muted, onMuted);
      pub.off(TrackEvent.Unmuted, onUnmuted);
    };
  }, [pub]);

  const isTargeted =
    Boolean(localParticipant) &&
    (roomState.intercom_target_id === localParticipant?.identity ||
      roomState.intercom_target_id === INTERCOM_ALL);

  const trackRef = director && pub ? { participant: director, publication: pub, source: Track.Source.Unknown } : undefined;

  return {
    isSpeaking: isTargeted && Boolean(pub) && !isMuted,
    trackRef: isTargeted ? trackRef : undefined,
  };
}
