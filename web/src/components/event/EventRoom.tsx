"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { LiveEvent } from "@/lib/types";
import { EVENT_STATUS_LABELS } from "@/lib/types";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { ChatPanel } from "./ChatPanel";
import { PresenceBadge } from "./PresenceBadge";
import { ReactionBar, ReactionOverlay, useReactions } from "./Reactions";
import { ActivityOverlay, InteractionPanel, useActivities } from "./Activities";

interface EventRoomProps {
  initialEvent: LiveEvent;
  userId: string;
  userName: string;
  isAdmin: boolean;
}

type Tab = "chat" | "interacao";

export function EventRoom({ initialEvent, userId, userName, isAdmin }: EventRoomProps) {
  const [event, setEvent] = useState(initialEvent);
  const [tab, setTab] = useState<Tab>("chat");
  const { floats, send } = useReactions(initialEvent.id);
  const activities = useActivities(initialEvent.id, userId);
  const router = useRouter();

  // Atividade abriu ao vivo → traz o participante para a aba Interação
  useEffect(() => {
    if (activities.alert) setTab("interacao");
  }, [activities.alert]);

  // Atualiza status/fonte do vídeo em tempo real (ex.: evento entra no ar)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event:${event.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${event.id}` },
        (payload) => setEvent(payload.new as LiveEvent),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  // Registro de presença (relatório): marca entrada e renova a cada 60s
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("touch_attendance", { p_event_id: event.id, p_seconds: 0 });
    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") {
        supabase.rpc("touch_attendance", { p_event_id: event.id, p_seconds: 60 });
      }
    }, 60_000);
    return () => clearInterval(heartbeat);
  }, [event.id]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isLive = event.status === "live";

  return (
    <div
      className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden"
      style={{ "--brand": event.brand_color } as React.CSSProperties}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2 md:px-6">
        <div className="flex items-center gap-3">
          {event.brand_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.brand_logo_url}
              alt=""
              className="h-8 max-w-32 object-contain"
            />
          )}
          <h1 className="font-semibold tracking-tight">{event.title}</h1>
          <span
            className={
              isLive
                ? "rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400"
                : "rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs text-neutral-300"
            }
          >
            {isLive ? "● AO VIVO" : EVENT_STATUS_LABELS[event.status]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PresenceBadge eventId={event.id} userId={userId} userName={userName} />
          <span className="hidden text-sm text-neutral-400 sm:inline">{userName}</span>
          <button
            onClick={signOut}
            className="text-sm text-neutral-500 underline-offset-2 hover:underline"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 p-3 md:p-4 lg:min-h-0 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          {/* largura limitada pela altura disponível: o vídeo nunca empurra a página */}
          <div
            className="relative mx-auto w-full"
            style={{ maxWidth: "min(100%, calc((100dvh - 14rem) * 16 / 9))" }}
          >
            <ReactionOverlay floats={floats} />
            <ActivityOverlay state={activities} />
            {isLive ? (
              <StreamPlayer
                provider={event.stream_provider}
                streamRef={event.stream_ref}
                title={event.title}
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-neutral-900 text-neutral-400">
                <p className="text-lg font-medium">
                  {event.status === "ended"
                    ? "Esta transmissão foi encerrada."
                    : "A transmissão ainda não começou."}
                </p>
                {event.starts_at && event.status === "scheduled" && (
                  <p className="text-sm">
                    Início previsto:{" "}
                    {new Date(event.starts_at).toLocaleString("pt-BR", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-4">
            {isLive ? <ReactionBar onSend={send} /> : <span />}
          </div>

          {event.description && (
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-neutral-400">
              {event.description}
            </p>
          )}
        </div>

        <aside className="flex h-[60dvh] w-full flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 lg:h-auto lg:min-h-0 lg:w-96">
          <div className="flex border-b border-neutral-800">
            {event.chat_enabled && (
              <button
                onClick={() => setTab("chat")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                  tab === "chat"
                    ? "border-b-2 border-[var(--brand)] text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Chat
              </button>
            )}
            {activities.activities.length > 0 && (
              <button
                onClick={() => {
                  setTab("interacao");
                  activities.clearAlert();
                }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                  tab === "interacao"
                    ? "border-b-2 border-[var(--brand)] text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Interação
                {activities.alert && tab !== "interacao" && (
                  <span className="ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                )}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "chat" && event.chat_enabled ? (
              <ChatPanel eventId={event.id} userId={userId} isAdmin={isAdmin} />
            ) : (
              <InteractionPanel state={activities} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
