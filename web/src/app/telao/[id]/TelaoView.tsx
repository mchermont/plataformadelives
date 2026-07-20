"use client";

import { useEffect, useMemo, useState } from "react";
import { Dices } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RaffleWinner, ScreenRaffle, ScreenState } from "@/lib/types";
import { ActivityResultsView } from "@/components/event/ActivityResultsView";
import { DisableInspect } from "@/components/event/DisableInspect";

const WHEEL_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#6366f1",
  "#f97316",
  "#d946ef",
];

/** Sorteio no telão: roleta/moeda com suspense e revelação dos ganhadores. */
function RaffleScreen({ raffle }: { raffle: ScreenRaffle }) {
  // suspense: roleta gira / moeda vira antes de revelar
  const suspenseMs =
    raffle.visual === "wheel" ? 3600 : raffle.visual === "coin" ? 2600 : 0;
  const [revealed, setRevealed] = useState(suspenseMs === 0);

  useEffect(() => {
    setRevealed(suspenseMs === 0);
    if (suspenseMs === 0) return;
    const timer = setTimeout(() => setRevealed(true), suspenseMs);
    return () => clearTimeout(timer);
  }, [raffle.id, suspenseMs]);

  const winners =
    raffle.kind === "participants"
      ? (raffle.result as RaffleWinner[]).map((w) => w.name)
      : (raffle.result as (number | string)[]).map(String);

  return (
    <div className="w-full max-w-6xl text-center">
      <h1
        className="mb-[4vh] flex items-center justify-center gap-3 text-balance font-bold leading-tight"
        style={{ fontSize: "min(4.5vw, 3.5rem)" }}
      >
        <Dices className="shrink-0" style={{ width: "0.85em", height: "0.85em" }} /> {raffle.title}
      </h1>

      {!revealed && raffle.visual === "wheel" && (
        <div className="relative mx-auto" style={{ width: "min(38vh, 26rem)" }}>
          <div
            className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-5xl"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))" }}
          >
            ▼
          </div>
          <div
            className="raffle-wheel-spin aspect-square rounded-full border-8 border-white/20 shadow-2xl"
            style={{
              background: `conic-gradient(${WHEEL_COLORS.map(
                (c, i) =>
                  `${c} ${(i * 100) / WHEEL_COLORS.length}% ${((i + 1) * 100) / WHEEL_COLORS.length}%`,
              ).join(", ")})`,
            }}
          />
          <p className="mt-[4vh] animate-pulse text-2xl text-neutral-300">
            Sorteando…
          </p>
        </div>
      )}

      {!revealed && raffle.visual === "coin" && (
        <div style={{ perspective: "800px" }}>
          <div
            className="raffle-coin-flip mx-auto flex aspect-square items-center justify-center rounded-full bg-amber-400 text-8xl shadow-2xl"
            style={{ width: "min(30vh, 18rem)" }}
          >
            🪙
          </div>
          <p className="mt-[4vh] animate-pulse text-2xl text-neutral-300">
            Girando…
          </p>
        </div>
      )}

      {revealed && (
        <>
          <div className="flex flex-wrap items-center justify-center gap-[1.5vw]">
            {winners.map((name, i) => (
              <div
                key={`${raffle.id}-${i}`}
                className="telao-in rounded-2xl border border-white/15 bg-white/10 px-[3vw] py-[2.5vh] font-bold shadow-xl"
                style={{
                  fontSize:
                    winners.length <= 2 ? "min(5vw, 4rem)" : "min(3vw, 2.25rem)",
                  animationDelay: `${0.4 + i * 0.7}s`,
                  borderTopColor: "var(--brand, #0284c7)",
                  borderTopWidth: 6,
                }}
              >
                {raffle.kind === "coin" ? `🪙 ${name}` : `🏆 ${name}`}
              </div>
            ))}
          </div>
          {raffle.kind === "participants" && raffle.total_entries != null && (
            <p
              className="telao-in mt-[5vh] text-xl text-neutral-400"
              style={{ animationDelay: `${0.4 + winners.length * 0.7}s` }}
            >
              {raffle.total_entries} participantes concorreram · sorteio
              auditável
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Fundos: dark (padrão) · transparent (compor no OBS) · green (chroma key)
 * · art (arte de fundo do evento).
 */
export function TelaoView({ eventId, bg }: { eventId: string; bg: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<ScreenState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const { data } = await supabase.rpc("get_screen_state", {
        p_event_id: eventId,
      });
      if (alive) {
        setState((data as ScreenState) ?? null);
        setLoaded(true);
      }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [supabase, eventId]);

  // O body do app é escuro — para chroma/transparência o fundo precisa vazar
  useEffect(() => {
    const previous = document.body.style.background;
    if (bg === "transparent") document.body.style.background = "transparent";
    if (bg === "green") document.body.style.background = "#00b140";
    return () => {
      document.body.style.background = previous;
    };
  }, [bg]);

  const activity = state?.activity ?? null;
  const raffle = state?.raffle ?? null;
  const brand = state?.event?.brand_color;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="flex min-h-dvh flex-col items-center justify-center p-[4vw]"
      style={
        {
          ...(brand ? { "--brand": brand } : {}),
          ...(bg === "art" && state?.event?.bg_image_url
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,.6)), url(${state.event.bg_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}),
        } as React.CSSProperties
      }
    >
      <DisableInspect />
      {raffle ? (
        // sorteio exibido tem prioridade sobre a atividade
        <RaffleScreen key={raffle.id} raffle={raffle} />
      ) : activity ? (
        <div key={activity.id} className="telao-in w-full max-w-6xl text-center">
          <h1
            className="mb-[4vh] text-balance font-bold leading-tight"
            style={{ fontSize: "min(4.5vw, 3.5rem)" }}
          >
            {activity.title}
          </h1>
          <div className="text-left">
            <ActivityResultsView
              activity={activity}
              results={state?.results ?? null}
              size="screen"
            />
          </div>
          {activity.status === "open" && (
            <p className="mt-[5vh] animate-pulse text-2xl text-neutral-300">
              Responda agora na sala da live!
            </p>
          )}
        </div>
      ) : loaded ? (
        // Sem atividade: tela limpa (nada para compor no stream)
        bg === "dark" && state?.event ? (
          <div className="text-center text-neutral-500">
            {state.event.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.event.brand_logo_url}
                alt=""
                className="mx-auto mb-4 h-16 object-contain opacity-60"
              />
            )}
            <p className="text-xl">{state.event.title}</p>
            <p className="mt-2 text-sm">
              Aguardando o diretor abrir uma atividade…
            </p>
          </div>
        ) : null
      ) : null}
    </div>
  );
}
