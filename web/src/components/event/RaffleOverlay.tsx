"use client";

import { useEffect, useMemo, useState } from "react";
import { Dices, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RaffleWinner, ScreenRaffle } from "@/lib/types";

/** Sorteio em exibição na sala (polling leve — RPC dedicada, 3s). */
export function useDisplayedRaffle(eventId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [raffle, setRaffle] = useState<ScreenRaffle | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const { data } = await supabase.rpc("get_displayed_raffle", {
        p_event_id: eventId,
      });
      if (!alive) return;
      const next = (data as ScreenRaffle | null) ?? null;
      // preserva a identidade do objeto enquanto for o mesmo sorteio
      // (senão o overlay reiniciaria a contagem a cada poll)
      setRaffle((prev) => (prev?.id === next?.id ? (next ? prev : null) : next));
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [supabase, eventId]);

  return raffle;
}

/** Overlay sobre o player: contagem regressiva de 5s e revelação do resultado. */
export function RaffleOverlay({ raffle }: { raffle: ScreenRaffle | null }) {
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [count, setCount] = useState(5);

  const raffleId = raffle?.id ?? null;
  useEffect(() => {
    if (!raffleId) return;
    setCount(5);
    const interval = setInterval(
      () => setCount((c) => (c <= 1 ? 0 : c - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [raffleId]);

  if (!raffle || raffle.id === dismissedId) return null;

  const winners =
    raffle.kind === "participants"
      ? (raffle.result as RaffleWinner[]).map((w) => w.name)
      : (raffle.result as (number | string)[]).map(String);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-full w-full max-w-md flex-col items-center gap-3 overflow-y-auto rounded-xl bg-neutral-950/90 p-5 text-center shadow-2xl">
        <button
          onClick={() => setDismissedId(raffle.id)}
          aria-label="Fechar"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
        >
          <X className="size-3.5" />
        </button>
        <h3 className="flex items-center justify-center gap-1.5 text-balance text-lg font-bold">
          <Dices className="size-5 shrink-0" /> {raffle.title}
        </h3>

        {count > 0 ? (
          <>
            <div
              key={count}
              className="raffle-count text-7xl font-black tabular-nums"
              style={{ color: "var(--brand, #0284c7)" }}
            >
              {count}
            </div>
            <p className="animate-pulse text-sm text-neutral-400">Sorteando…</p>
          </>
        ) : (
          <>
            {raffle.kind === "numbers" ? (
              // números: chips lado a lado, quebrando em poucas linhas (sem scroll)
              <div className="flex w-full flex-wrap items-center justify-center gap-2">
                {winners.map((n, i) => (
                  <div
                    key={`${raffle.id}-${i}`}
                    className="telao-in rounded-xl border border-white/15 bg-white/10 px-4 py-2 font-black tabular-nums shadow-lg"
                    style={{
                      fontSize: winners.length <= 6 ? "1.75rem" : "1.25rem",
                      animationDelay: `${0.2 + i * 0.35}s`,
                      borderTopColor: "var(--brand, #0284c7)",
                      borderTopWidth: 4,
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-2">
                {winners.map((name, i) => (
                  <div
                    key={`${raffle.id}-${i}`}
                    className="telao-in w-full break-words rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 font-bold shadow-lg"
                    style={{
                      fontSize: winners.length <= 2 ? "1.5rem" : "1.1rem",
                      animationDelay: `${0.2 + i * 0.6}s`,
                      borderTopColor: "var(--brand, #0284c7)",
                      borderTopWidth: 4,
                    }}
                  >
                    {raffle.kind === "coin" ? `🪙 ${name}` : `🏆 ${name}`}
                  </div>
                ))}
              </div>
            )}
            {raffle.kind === "participants" && raffle.total_entries != null && (
              <p
                className="telao-in text-xs text-neutral-400"
                style={{ animationDelay: `${0.2 + winners.length * 0.6}s` }}
              >
                {raffle.total_entries} participantes concorreram · sorteio
                auditável
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
