"use client";

import { useCallback, useEffect } from "react";
import {
  useLocalParticipant,
  useParticipantAttribute,
} from "@livekit/components-react";

/**
 * Deriva se o participante local está no palco (a partir do atributo
 * `isOnStage` gravado por /api/studio/stage e sincronizado via Realtime —
 * migração 0033) e força o microfone a acompanhar isso sempre: mudo no
 * backstage, ligado no palco — sem depender de o participante clicar em
 * nada. É captura local, só o próprio navegador consegue mutar de verdade.
 */
export function useStudioSelfStage() {
  const { localParticipant } = useLocalParticipant();
  const isDirector = localParticipant?.identity?.startsWith("diretor-") ?? false;

  const attr = useParticipantAttribute("isOnStage", { participant: localParticipant });
  // Diretor começa no palco por padrão (attr ainda vazio); convidado começa no backstage.
  const isOnStage = isDirector ? attr !== "false" : attr === "true";

  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setMicrophoneEnabled(isOnStage).catch(() => {});
  }, [isOnStage, localParticipant]);

  /** Usar no lugar de `localParticipant.setMicrophoneEnabled` nos botões de UI — só tem efeito no palco. */
  const setDesiredMicOn = useCallback(
    (on: boolean) => {
      if (isOnStage && localParticipant) {
        localParticipant.setMicrophoneEnabled(on).catch(() => {});
      }
    },
    [isOnStage, localParticipant],
  );

  return { isOnStage, setDesiredMicOn };
}
