"use client";

import { useLocalParticipant, useParticipants, useTrackMutedIndicator } from "@livekit/components-react";
import { Track } from "livekit-client";
import type { StudioRoom } from "@/lib/types";

const INTERCOM_TRACK_NAME = "intercom";
export const INTERCOM_ALL = "__all__";

/**
 * Lado de quem PODE ser o alvo do intercom (convidado/intérprete). Acha a
 * track de intercom do Diretor (nome, não fonte — a fonte é `Unknown`,
 * inespecífica) e só considera "sendo chamado" se `intercom_target_id`
 * bater com a própria identity ou for "Todos". O aviso "Diretor falando"
 * sai do estado de mute da própria track (instantâneo, sem Supabase).
 */
export function useIntercomListener(roomState: StudioRoom) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const director = participants.find((p) => p.identity.startsWith("diretor-"));
  const pub = director?.getTrackPublicationByName(INTERCOM_TRACK_NAME);

  const isTargeted =
    Boolean(localParticipant) &&
    (roomState.intercom_target_id === localParticipant?.identity ||
      roomState.intercom_target_id === INTERCOM_ALL);

  const trackRef = director && pub ? { participant: director, publication: pub, source: Track.Source.Unknown } : undefined;
  const { isMuted } = useTrackMutedIndicator(trackRef);

  return {
    isSpeaking: isTargeted && Boolean(pub) && !isMuted,
    trackRef: isTargeted ? trackRef : undefined,
  };
}
