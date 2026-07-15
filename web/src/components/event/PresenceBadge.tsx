"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PresenceBadgeProps {
  eventId: string;
  userId: string;
  userName: string;
}

/** Conta usuários online no evento via Supabase Realtime Presence. */
export function PresenceBadge({ eventId, userId, userName }: PresenceBadgeProps) {
  const [online, setOnline] = useState(1);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:${eventId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: userName, joined_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId, userName]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      {online} online
    </span>
  );
}
