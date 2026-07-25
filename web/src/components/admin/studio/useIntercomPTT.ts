"use client";

import { useCallback, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track, type LocalTrackPublication } from "livekit-client";

const INTERCOM_TRACK_NAME = "intercom";

/**
 * Push-to-talk do Diretor: publica uma SEGUNDA track de áudio, separada
 * do microfone principal (nome/fonte diferentes — nunca colide nem é
 * afetada pela lógica de mute automático do palco/backstage). Fica muda
 * entre os apertos; apertar/soltar só troca o mute da track já publicada
 * (instantâneo via LiveKit, sem passar pelo Supabase). A track em si só é
 * criada no primeiro aperto — quem nunca usa intercom nunca é obrigado a
 * dar permissão de mic extra.
 */
export function useIntercomPTT() {
  const { localParticipant } = useLocalParticipant();
  const pubRef = useRef<LocalTrackPublication | null>(null);
  const [isTalking, setIsTalking] = useState(false);

  const ensurePublished = useCallback(async () => {
    if (pubRef.current) return pubRef.current;
    if (!localParticipant) return null;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaTrack = stream.getAudioTracks()[0];
    const pub = await localParticipant.publishTrack(mediaTrack, {
      name: INTERCOM_TRACK_NAME,
      source: Track.Source.Unknown,
    });
    pubRef.current = pub;
    return pub;
  }, [localParticipant]);

  const startTalking = useCallback(async () => {
    try {
      const pub = await ensurePublished();
      await pub?.unmute();
      setIsTalking(true);
    } catch (err) {
      console.error("Erro ao ativar o intercom:", err);
    }
  }, [ensurePublished]);

  const stopTalking = useCallback(() => {
    setIsTalking(false);
    pubRef.current?.mute().catch(() => {});
  }, []);

  return { startTalking, stopTalking, isTalking };
}
