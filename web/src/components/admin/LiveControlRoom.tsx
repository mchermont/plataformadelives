"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { EventStatus, LiveEvent } from "@/lib/types";
import { EVENT_STATUS_LABELS } from "@/lib/types";
import { ChatPanel } from "@/components/event/ChatPanel";
import { PresenceBadge } from "@/components/event/PresenceBadge";
import { ActivityManager } from "./ActivityManager";
import { QAManager } from "./QAManager";

interface LiveControlRoomProps {
  initialEvent: LiveEvent;
  userId: string;
  userName: string;
  isAdmin: boolean;
}

/** Painel "diretor de live": status, presença, chat e quiz numa tela só. */
export function LiveControlRoom({
  initialEvent,
  userId,
  userName,
  isAdmin,
}: LiveControlRoomProps) {
  const [event, setEvent] = useState(initialEvent);
  const [busy, setBusy] = useState(false);
  const [sideTab, setSideTab] = useState<"chat" | "perguntas">("chat");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`director:${event.id}`)
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

  async function setStatus(status: EventStatus) {
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("events")
      .update({ status })
      .eq("id", event.id)
      .select()
      .single();
    if (data) setEvent(data as LiveEvent);
    setBusy(false);
  }

  const isLive = event.status === "live";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">🎛 {event.title}</h1>
          <span
            className={
              isLive
                ? "rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400"
                : "rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300"
            }
          >
            {isLive ? "● AO VIVO" : EVENT_STATUS_LABELS[event.status]}
          </span>
          <PresenceBadge eventId={event.id} userId={userId} userName={userName} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/e/${event.slug}`}
            target="_blank"
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
          >
            Ver como participante ↗
          </Link>
        </div>
      </div>

      {isAdmin && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 p-3">
          <span className="mr-2 text-sm text-neutral-400">Transmissão:</span>
          {event.status !== "live" ? (
            <button
              onClick={() => setStatus("live")}
              disabled={busy}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              ● ENTRAR NO AR
            </button>
          ) : (
            <button
              onClick={() => setStatus("ended")}
              disabled={busy}
              className="rounded-lg border border-red-900 px-5 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950 disabled:opacity-40"
            >
              ■ Encerrar transmissão
            </button>
          )}
          {event.status === "ended" && (
            <button
              onClick={() => setStatus("scheduled")}
              disabled={busy}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-40"
            >
              Reagendar
            </button>
          )}
          <span className="ml-auto text-xs text-neutral-500">
            O player e o chat dos participantes reagem na hora, sem recarregar.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Atividades interativas · quiz, enquete, nuvem
          </h2>
          <ActivityManager eventId={event.id} />
        </section>

        <section className="flex flex-col">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Chat e perguntas · moderação
          </h2>
          <div className="flex h-[70dvh] flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 lg:sticky lg:top-4">
            {event.qa_enabled && (
              <div className="flex border-b border-neutral-800">
                {(["chat", "perguntas"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSideTab(t)}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition ${
                      sideTab === t
                        ? "border-b-2 border-sky-500 text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {t === "chat" ? "Chat" : "Perguntas"}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {sideTab === "perguntas" && event.qa_enabled ? (
                <QAManager eventId={event.id} />
              ) : (
                <ChatPanel eventId={event.id} userId={userId} isAdmin />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
