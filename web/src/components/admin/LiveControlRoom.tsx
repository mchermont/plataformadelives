"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Info, Monitor, Square, Tv, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EventStatus, LiveEvent } from "@/lib/types";
import { EVENT_STATUS_LABELS } from "@/lib/types";
import { ChatPanel } from "@/components/event/ChatPanel";
import { PresenceBadge } from "@/components/event/PresenceBadge";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { ActivityOverlay, useActivities } from "@/components/event/Activities";
import { RaffleOverlay, useDisplayedRaffle } from "@/components/event/RaffleOverlay";
import { ActivityManager } from "./ActivityManager";
import { QAManager } from "./QAManager";
import { GalleryManager } from "./GalleryManager";
import { RaffleManager } from "./RaffleManager";

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
  const [sideTab, setSideTab] = useState<"chat" | "perguntas" | "fotos">("chat");
  // prévias: o que o participante vê no player (overlays inclusos)
  const activities = useActivities(event.id, userId);
  const raffle = useDisplayedRaffle(event.id);
  // contagem de pendências: aba inativa não pode esconder algo esperando moderação
  const [pending, setPending] = useState({ chat: 0, perguntas: 0, fotos: 0 });
  const [telaoExpanded, setTelaoExpanded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    async function poll() {
      const [chat, perguntas, fotos] = await Promise.all([
        supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("approved", false)
          .is("deleted_at", null),
        event.qa_enabled
          ? supabase
              .from("questions")
              .select("*", { count: "exact", head: true })
              .eq("event_id", event.id)
              .eq("status", "pending")
          : Promise.resolve({ count: 0 }),
        event.gallery_enabled
          ? supabase
              .from("event_photos")
              .select("*", { count: "exact", head: true })
              .eq("event_id", event.id)
              .eq("status", "pending")
          : Promise.resolve({ count: 0 }),
      ]);
      if (alive) {
        setPending({
          chat: chat.count ?? 0,
          perguntas: perguntas.count ?? 0,
          fotos: fotos.count ?? 0,
        });
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [event.id, event.qa_enabled, event.gallery_enabled]);

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
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 p-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{event.title}</h1>
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

        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Transmissão:</span>
            {event.status !== "live" ? (
              <button
                onClick={() => setStatus("live")}
                disabled={busy}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                ● ENTRAR NO AR
              </button>
            ) : (
              <button
                onClick={() => setStatus("ended")}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-red-900 px-4 py-1.5 text-sm font-bold text-red-400 transition hover:bg-red-950 disabled:opacity-40"
              >
                <Square className="size-3.5 fill-current" /> Encerrar transmissão
              </button>
            )}
            {event.status === "ended" && (
              <button
                onClick={() => setStatus("scheduled")}
                disabled={busy}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-40"
              >
                Reagendar
              </button>
            )}
            <span
              title="O player e o chat dos participantes reagem na hora, sem recarregar."
              className="text-neutral-500"
            >
              <Info className="size-4" />
            </span>
          </div>
        )}

        <Link
          href={`/e/${event.slug}`}
          target="_blank"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
        >
          Ver como participante <ExternalLink className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[400px_minmax(0,1fr)_400px]">
        {/* Prévias: lado a lado no lg (linha inteira), coluna própria no xl */}
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 lg:sticky lg:top-4 lg:col-span-2 lg:self-start xl:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Prévias · o que o público está vendo
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <div className="relative overflow-hidden rounded-xl border border-neutral-800">
                {isLive ? (
                  <StreamPlayer
                    provider={event.stream_provider}
                    streamRef={event.stream_ref}
                    title={event.title}
                    coverUrl={event.cover_url || event.card_image_url}
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-neutral-900 text-sm text-neutral-500">
                    {event.status === "ended"
                      ? "Transmissão encerrada."
                      : "A transmissão ainda não começou."}
                  </div>
                )}
                <ActivityOverlay state={activities} />
                <RaffleOverlay raffle={raffle} />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500">
                <Monitor className="size-3.5" /> Player da sala (com overlays de atividade e sorteio)
              </p>
            </div>
            <div>
              <button
                onClick={() => setTelaoExpanded(true)}
                aria-label="Ampliar prévia do telão"
                className="relative block aspect-video w-full overflow-hidden rounded-xl border border-neutral-800 bg-black"
              >
                <iframe
                  src={`/telao/${event.id}`}
                  title="Prévia do telão"
                  className="pointer-events-none absolute left-0 top-0 h-[500%] w-[500%] origin-top-left scale-[0.2]"
                />
              </button>
              <p className="mt-1.5 flex items-center justify-between text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <Tv className="size-3.5" /> Telão (OBS) ao vivo
                </span>
                <Link
                  href={`/telao/${event.id}`}
                  target="_blank"
                  className="flex items-center gap-1 underline-offset-2 hover:text-white hover:underline"
                >
                  Abrir telão <ExternalLink className="size-3.5" />
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Atividades interativas · quiz, enquete, nuvem
          </h2>
          <ActivityManager eventId={event.id} enabledTypes={event.enabled_activity_types} />
          <RaffleManager eventId={event.id} />
        </section>

        <section className="flex h-[70dvh] flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 lg:sticky lg:top-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Chat e perguntas · moderação
          </h2>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/60">
            {(event.qa_enabled || event.gallery_enabled) && (
              <div className="flex border-b border-neutral-800">
                {(
                  [
                    ["chat", "Chat"],
                    ...(event.qa_enabled ? [["perguntas", "Perguntas"]] : []),
                    ...(event.gallery_enabled ? [["fotos", "Fotos"]] : []),
                  ] as [typeof sideTab, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setSideTab(t)}
                    className={`relative flex-1 px-4 py-2 text-sm font-medium transition ${
                      sideTab === t
                        ? "bg-sky-600 text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {label}
                    {pending[t] > 0 && sideTab !== t && (
                      <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                        {pending[t]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {sideTab === "perguntas" && event.qa_enabled ? (
                <QAManager eventId={event.id} />
              ) : sideTab === "fotos" && event.gallery_enabled ? (
                <GalleryManager eventId={event.id} />
              ) : (
                <ChatPanel
                  eventId={event.id}
                  userId={userId}
                  isAdmin
                  moderated={event.chat_moderation}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {telaoExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setTelaoExpanded(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-xl border border-neutral-700 bg-black shadow-2xl"
          >
            <iframe
              src={`/telao/${event.id}`}
              title="Prévia do telão (ampliada)"
              className="pointer-events-none absolute left-0 top-0 h-[500%] w-[500%] origin-top-left scale-[0.2]"
            />
          </div>
          <button
            onClick={() => setTelaoExpanded(false)}
            aria-label="Fechar"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-700"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
