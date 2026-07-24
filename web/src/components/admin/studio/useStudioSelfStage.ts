"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useLocalParticipant,
  useParticipantAttribute,
} from "@livekit/components-react";

/**
 * Deriva se o participante local está no palco (a partir do atributo
 * `isOnStage` gravado por /api/studio/stage e sincronizado via Realtime —
 * migração 0033) e aplica o mute automático do backstage: quando sai do
 * palco, desliga o microfone de verdade (é captura local, só o próprio
 * navegador consegue mutar); quando volta, restaura o que a pessoa tinha
 * escolhido manualmente antes.
 */
export function useStudioSelfStage() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const isDirector = localParticipant?.identity?.startsWith("diretor-") ?? false;

  const attr = useParticipantAttribute("isOnStage", { participant: localParticipant });
  // Diretor começa no palco por padrão (attr ainda vazio); convidado começa no backstage.
  const isOnStage = isDirector ? attr !== "false" : attr === "true";

  const desiredMicOnRef = useRef(true);
  const prevIsOnStageRef = useRef(isOnStage);

  // Enquanto está no palco, a preferência "desejada" acompanha o que a
  // pessoa realmente escolheu (clique manual no botão de mic).
  useEffect(() => {
    if (isOnStage) {
      desiredMicOnRef.current = isMicrophoneEnabled;
    }
  }, [isOnStage, isMicrophoneEnabled]);

  // Mute automático ao trocar de lado do palco.
  useEffect(() => {
    if (!localParticipant) return;
    const wasOnStage = prevIsOnStageRef.current;
    prevIsOnStageRef.current = isOnStage;

    if (isOnStage && !wasOnStage) {
      // Subiu ao palco: restaura o mic pro que a pessoa tinha escolhido.
      localParticipant.setMicrophoneEnabled(desiredMicOnRef.current).catch(() => {});
    } else if (!isOnStage && localParticipant.isMicrophoneEnabled) {
      // Backstage: força mudo sem mexer na preferência salva.
      localParticipant.setMicrophoneEnabled(false).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnStage, localParticipant]);

  /** Usar no lugar de `localParticipant.setMicrophoneEnabled` nos botões de UI. */
  const setDesiredMicOn = useCallback(
    (on: boolean) => {
      desiredMicOnRef.current = on;
      if (isOnStage && localParticipant) {
        localParticipant.setMicrophoneEnabled(on).catch(() => {});
      }
      // No backstage o clique só guarda a preferência — o mic continua
      // mudo até a pessoa subir ao palco.
    },
    [isOnStage, localParticipant],
  );

  return { isOnStage, setDesiredMicOn };
}
