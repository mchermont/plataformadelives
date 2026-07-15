"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const EMOJIS = ["👏", "❤️", "🔥", "😂", "👍"];

interface FloatingEmoji {
  id: number;
  emoji: string;
  left: number;
}

/**
 * Reações em tempo real via Realtime Broadcast (sem tabela).
 * Renderiza a barra de botões e o overlay de emojis flutuantes —
 * o overlay deve ficar dentro de um container `relative` sobre o player.
 */
export function useReactions(eventId: string) {
  const [floats, setFloats] = useState<FloatingEmoji[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`reactions:${eventId}`)
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        if (typeof payload?.emoji === "string" && EMOJIS.includes(payload.emoji)) {
          spawn(payload.emoji);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [eventId]);

  function spawn(emoji: string) {
    const id = Date.now() + Math.random();
    setFloats((prev) => [...prev.slice(-40), { id, emoji, left: 8 + Math.random() * 84 }]);
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 3000);
  }

  function send(emoji: string) {
    const now = Date.now();
    if (now - lastSentRef.current < 250) return; // anti-flood local
    lastSentRef.current = now;
    channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
    spawn(emoji); // o broadcast não ecoa para quem envia
  }

  return { floats, send };
}

export function ReactionOverlay({ floats }: { floats: FloatingEmoji[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {floats.map((f) => (
        <span
          key={f.id}
          className="reaction-float absolute bottom-2"
          style={{ left: `${f.left}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar({ onSend }: { onSend: (emoji: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSend(emoji)}
          title="Enviar reação"
          className="rounded-full bg-neutral-800/80 px-2.5 py-1 text-lg transition hover:scale-110 hover:bg-neutral-700 active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
