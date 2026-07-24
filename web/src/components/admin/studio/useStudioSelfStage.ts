"use client";

import { useCallback, useEffect, useRef } from "react";
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
 *
 * No backstage a checagem é CONTÍNUA (não só na transição): o LiveKit
 * publica o mic sozinho ao conectar (`<LiveKitRoom audio>`), e essa
 * publicação pode terminar DEPOIS do nosso primeiro mute — corrida mais
 * visível com muitos participantes/CPU ocupada, que fazia o convidado
 * entrar sem mutar de verdade. Reagindo também à mudança real do mic
 * (não só ao atributo de palco), o efeito se autocorrige assim que o
 * LiveKit liga o mic por conta própria, em vez de depender de um único
 * disparo bem cronometrado. Ao SUBIR ao palco o desmute é só um "empurrão"
 * na transição (não contínuo) — pra não brigar com um mute manual que o
 * participante escolha fazer depois de já estar no ar.
 */
export function useStudioSelfStage() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const isDirector = localParticipant?.identity?.startsWith("diretor-") ?? false;

  const attr = useParticipantAttribute("isOnStage", { participant: localParticipant });
  // Diretor começa no palco por padrão (attr ainda vazio); convidado começa no backstage.
  const isOnStage = isDirector ? attr !== "false" : attr === "true";

  const prevIsOnStageRef = useRef(isOnStage);

  useEffect(() => {
    if (!localParticipant) return;

    if (!isOnStage) {
      // Backstage: garante mudo sempre — corrige mesmo se o LiveKit ligar
      // o mic sozinho depois do nosso primeiro mute.
      if (isMicrophoneEnabled) {
        localParticipant.setMicrophoneEnabled(false).catch(() => {});
      }
    } else if (!prevIsOnStageRef.current) {
      // Acabou de subir ao palco: desmuta uma vez só. Depois disso o
      // participante controla o próprio mic livremente.
      localParticipant.setMicrophoneEnabled(true).catch(() => {});
    }

    prevIsOnStageRef.current = isOnStage;
  }, [isOnStage, isMicrophoneEnabled, localParticipant]);

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
