"use client";

import { useEffect } from "react";
import type { StudioRoom } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

/**
 * Enquanto a transmissão estiver em transição/ativa, consulta
 * `/api/studio/egress/status` periodicamente — essa rota já grava o
 * status atualizado em `studio_rooms`, e o Realtime (já assinado em
 * `StudioControlRoom`) propaga a mudança de volta pro `roomState` sem
 * esse hook precisar manter estado próprio.
 */
export function useStudioEgressStatus(eventId: string, egressStatus: StudioRoom["egress_status"]) {
  useEffect(() => {
    if (!egressStatus) return;

    const poll = () => {
      fetch(`/api/studio/egress/status?eventId=${eventId}`).catch(() => {});
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [eventId, egressStatus]);
}
