"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ScreenState } from "@/lib/types";
import { ActivityResultsView } from "@/components/event/ActivityResultsView";

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
  const brand = state?.event?.brand_color;

  return (
    <div
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
      {activity ? (
        <div className="w-full max-w-6xl text-center">
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
