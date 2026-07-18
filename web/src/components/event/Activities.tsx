"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Activity, ActivityResponse, ActivityResults } from "@/lib/types";
import { ActivityResultsView } from "./ActivityResultsView";

/**
 * Estado das atividades interativas do participante.
 * Uma instância só (no EventRoom) alimenta a aba Interação e o overlay.
 */
export function useActivities(eventId: string, userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [myResponses, setMyResponses] = useState<ActivityResponse[]>([]);
  const [results, setResults] = useState<Record<string, ActivityResults>>({});
  const [alert, setAlert] = useState(false);

  const load = useCallback(async () => {
    const [{ data: acts }, { data: mine }] = await Promise.all([
      supabase
        .from("activities")
        .select("*")
        .eq("event_id", eventId)
        .in("status", ["open", "closed"])
        .order("opened_at", { ascending: false }),
      supabase.from("activity_responses").select("*").eq("user_id", userId),
    ]);
    setActivities((acts as Activity[]) ?? []);
    setMyResponses((mine as ActivityResponse[]) ?? []);
  }, [supabase, eventId, userId]);

  // Resultados agregados das atividades cujo resultado o participante pode ver
  const loadResults = useCallback(async () => {
    const visible = (await supabase
      .from("activities")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["open", "closed"])) ?? {};
    const acts = ((visible as { data?: Activity[] }).data ?? []).filter(
      (a) => a.results_visible === "live" || a.results_published,
    );
    const entries = await Promise.all(
      acts.map(async (a) => {
        const { data } = await supabase.rpc("get_activity_results", {
          p_activity_id: a.id,
        });
        return [a.id, data as ActivityResults] as const;
      }),
    );
    setResults(Object.fromEntries(entries.filter(([, r]) => r)));
  }, [supabase, eventId]);

  useEffect(() => {
    load();
    loadResults();
    const channel = supabase
      .channel(`activities:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const next = payload.new as Activity | undefined;
          if (next?.status === "open") setAlert(true);
          load();
          loadResults();
        },
      )
      .subscribe();
    // fallback p/ eventos que o RLS do realtime não entrega (ex.: "limpar")
    const interval = setInterval(() => {
      load();
      loadResults();
    }, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, eventId, load, loadResults]);

  const open = activities.find((a) => a.status === "open") ?? null;
  return {
    activities,
    open,
    myResponses,
    results,
    alert,
    clearAlert: () => setAlert(false),
    refresh: () => {
      load();
      loadResults();
    },
  };
}

export type ActivitiesState = ReturnType<typeof useActivities>;

/** Interação com UMA atividade (input + resultado quando permitido). */
function ActivityCard({
  activity,
  state,
}: {
  activity: Activity;
  state: ActivitiesState;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mine = state.myResponses.filter((r) => r.activity_id === activity.id);
  const isOpen = activity.status === "open";
  const canSeeResults =
    activity.results_visible === "live" || activity.results_published;
  const results = state.results[activity.id] ?? null;

  async function submit(payload: { word?: string; option_index?: number }) {
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.rpc("submit_activity_response", {
      p_activity_id: activity.id,
      p_payload: payload,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes("bloqueada")) setFeedback("Essa palavra não é permitida.");
      else if (msg.includes("Limite")) setFeedback("Você atingiu o limite de envios.");
      else if (msg.includes("já enviou")) setFeedback("Você já enviou essa palavra.");
      else if (msg.includes("já votou")) setFeedback("Você já votou nesta enquete.");
      else if (msg.includes("não está aberta")) setFeedback("Esta atividade foi encerrada.");
      else if (msg.includes("inscritos")) setFeedback("Só participantes inscritos podem responder.");
      else setFeedback(`Não foi possível enviar (${msg}).`);
    } else {
      setWord("");
      state.refresh();
      inputRef.current?.focus();
    }
    setBusy(false);
  }

  const maxEntries = activity.config.max_entries ?? 3;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isOpen ? "border-sky-800 bg-sky-950/40" : "border-neutral-800"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-sky-400">
          {activity.type === "word_cloud" ? "Nuvem de palavras" : "Enquete"}
          {isOpen ? " · ao vivo" : ""}
        </span>
        {!isOpen && (
          <span className="text-xs text-neutral-500">Encerrada</span>
        )}
      </div>
      <p className="mb-3 font-medium">{activity.title}</p>

      {feedback && <p className="mb-2 text-xs text-amber-400">{feedback}</p>}

      {activity.type === "word_cloud" ? (
        <>
          {isOpen && mine.length < maxEntries && (
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (word.trim()) submit({ word: word.trim() });
              }}
            >
              <input
                ref={inputRef}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                maxLength={30}
                placeholder="Digite uma palavra…"
                className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={busy || !word.trim()}
                className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Enviar
              </button>
            </form>
          )}
          {isOpen && (
            <p className="mb-3 text-xs text-neutral-500">
              {mine.length}/{maxEntries} envio{maxEntries === 1 ? "" : "s"}
              {mine.length > 0 &&
                ` — você enviou: ${mine.map((r) => r.payload.word).join(", ")}`}
              {mine.some((r) => !r.approved) && " (aguardando moderação)"}
            </p>
          )}
        </>
      ) : (
        <div className="mb-3 space-y-2">
          {(activity.config.options ?? []).map((option, i) => {
            const voted = mine[0]?.payload.option_index;
            const chosen = voted === i;
            return (
              <button
                key={i}
                onClick={() => submit({ option_index: i })}
                disabled={busy || !isOpen || voted !== undefined}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  chosen
                    ? "border-[var(--brand,#0284c7)] bg-[var(--brand,#0284c7)]/20 font-semibold"
                    : "border-neutral-700 bg-neutral-900 hover:border-neutral-500 disabled:opacity-50"
                }`}
              >
                {option}
              </button>
            );
          })}
          {mine.length > 0 && (
            <p className="text-xs text-neutral-400">Voto registrado!</p>
          )}
        </div>
      )}

      {canSeeResults ? (
        <ActivityResultsView activity={activity} results={results} />
      ) : (
        <p className="text-xs text-neutral-500">
          O resultado aparece quando o apresentador exibir.
        </p>
      )}
    </div>
  );
}

/** Aba "Interação" da sala. */
export function InteractionPanel({ state }: { state: ActivitiesState }) {
  if (state.activities.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-neutral-500">
        Nenhuma atividade no momento. Fique de olho!
      </p>
    );
  }
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {state.activities.map((a) => (
        <ActivityCard key={a.id} activity={a} state={state} />
      ))}
    </div>
  );
}

/** Overlay sobre o vídeo para atividade aberta marcada como destaque. */
export function ActivityOverlay({ state }: { state: ActivitiesState }) {
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const open = state.open;
  if (!open || !open.highlight || open.id === dismissedId) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md">
        <button
          onClick={() => setDismissedId(open.id)}
          aria-label="Fechar"
          className="absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-sm text-neutral-300 hover:bg-neutral-700"
        >
          ✕
        </button>
        <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-neutral-950/90 shadow-2xl">
          <ActivityCard activity={open} state={state} />
        </div>
      </div>
    </div>
  );
}
