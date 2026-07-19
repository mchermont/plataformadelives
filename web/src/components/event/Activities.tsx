"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Activity,
  ActivityResponse,
  ActivityResults,
  QuizQuestion,
} from "@/lib/types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import { ActivityResultsView, RankingList } from "./ActivityResultsView";

/**
 * Estado das atividades interativas do participante.
 * Uma instância só (no EventRoom) alimenta a aba Interação e o overlay.
 */
export function useActivities(eventId: string, userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [myResponses, setMyResponses] = useState<ActivityResponse[]>([]);
  const [results, setResults] = useState<Record<string, ActivityResults>>({});
  const [quizQuestions, setQuizQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [myQuizAnswers, setMyQuizAnswers] = useState<Record<string, number>>({});
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
    const list = (acts as Activity[]) ?? [];
    setActivities(list);
    setMyResponses((mine as ActivityResponse[]) ?? []);

    // perguntas dos quizzes lançados + minhas respostas (p/ marcar o que já respondi)
    const quizActs = list.filter((a) => a.type === "quiz" && a.quiz_id);
    if (quizActs.length > 0) {
      const [{ data: qs }, { data: answers }] = await Promise.all([
        supabase
          .from("quiz_questions")
          .select("*")
          .in("quiz_id", quizActs.map((a) => a.quiz_id as string))
          .neq("status", "pending")
          .order("position", { ascending: true }),
        supabase.from("quiz_answers").select("*").eq("user_id", userId),
      ]);
      const byActivity: Record<string, QuizQuestion[]> = {};
      for (const a of quizActs) {
        byActivity[a.id] = ((qs as QuizQuestion[]) ?? []).filter(
          (q) => q.quiz_id === a.quiz_id,
        );
      }
      setQuizQuestions(byActivity);
      const map: Record<string, number> = {};
      for (const ans of answers ?? []) map[ans.question_id] = ans.selected_index;
      setMyQuizAnswers(map);
    } else {
      setQuizQuestions({});
      setMyQuizAnswers({});
    }
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
    quizQuestions,
    myQuizAnswers,
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const statements = activity.config.statements ?? [];
  const scaleMax = activity.config.scale_max ?? 5;
  const orderOptions = activity.config.options ?? [];
  // estado local por card (o componente é montado por atividade via key)
  const [ratings, setRatings] = useState<number[]>(() =>
    statements.map(() => Math.ceil(scaleMax / 2)),
  );
  const [order, setOrder] = useState<number[]>(() =>
    orderOptions.map((_, i) => i),
  );
  // matrix: um par de valores (x, y) por item
  const [xs, setXs] = useState<number[]>(() =>
    orderOptions.map(() => Math.ceil(scaleMax / 2)),
  );
  const [ys, setYs] = useState<number[]>(() =>
    orderOptions.map(() => Math.ceil(scaleMax / 2)),
  );

  function moveItem(pos: number, delta: number) {
    setOrder((cur) => {
      const next = [...cur];
      const target = pos + delta;
      if (target < 0 || target >= next.length) return cur;
      [next[pos], next[target]] = [next[target], next[pos]];
      return next;
    });
  }

  const mine = state.myResponses.filter((r) => r.activity_id === activity.id);
  const isOpen = activity.status === "open";
  const canSeeResults =
    activity.results_visible === "live" || activity.results_published;
  const results = state.results[activity.id] ?? null;
  const questions = state.quizQuestions[activity.id] ?? [];

  // Paginação do quiz: uma pergunta por vez, navegação manual
  const [page, setPage] = useState(0);
  // Paginação das escalas: uma afirmação por página
  const [scalePage, setScalePage] = useState(0);
  const pageIndex = Math.min(page, Math.max(0, questions.length - 1));
  const openIds = questions
    .filter((q) => q.status === "open")
    .map((q) => q.id)
    .join(",");
  // Nova rodada aberta → pula para a primeira pergunta ainda não respondida
  useEffect(() => {
    if (!openIds) return;
    const idx = questions.findIndex(
      (q) => q.status === "open" && state.myQuizAnswers[q.id] === undefined,
    );
    if (idx >= 0) setPage(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIds]);

  async function answerQuiz(question: QuizQuestion, index: number) {
    if (state.myQuizAnswers[question.id] !== undefined) return;
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.rpc("answer_question", {
      p_question_id: question.id,
      p_selected: index,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes("inscrição")) {
        setFeedback(
          "Só participantes inscritos pontuam no quiz. Você está logado como equipe/admin — para testar, use uma conta de participante.",
        );
      } else if (msg.includes("duplicate") || error.code === "23505") {
        setFeedback("Você já respondeu esta pergunta.");
      } else if (msg.includes("não está aberta")) {
        setFeedback("Esta pergunta já foi encerrada.");
      } else {
        setFeedback(`Não foi possível registrar (${msg}).`);
      }
    } else {
      state.refresh();
    }
    setBusy(false);
  }

  async function submit(payload: ActivityResponse["payload"]) {
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.rpc("submit_activity_response", {
      p_activity_id: activity.id,
      p_payload: payload,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes("bloqueada")) setFeedback("Esse conteúdo não é permitido.");
      else if (msg.includes("Limite")) setFeedback("Você atingiu o limite de envios.");
      else if (msg.includes("já enviou")) setFeedback("Você já enviou.");
      else if (msg.includes("já votou") || msg.includes("já respondeu"))
        setFeedback("Você já respondeu esta atividade.");
      else if (msg.includes("não está aberta")) setFeedback("Esta atividade foi encerrada.");
      else if (msg.includes("inscritos")) setFeedback("Só participantes inscritos podem responder.");
      else setFeedback(`Não foi possível enviar (${msg}).`);
    } else {
      setWord("");
      setText("");
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
          {ACTIVITY_TYPE_LABELS[activity.type]}
          {isOpen ? " · ao vivo" : ""}
        </span>
        {!isOpen && (
          <span className="text-xs text-neutral-500">Encerrada</span>
        )}
      </div>
      <p className="mb-3 font-medium">{activity.title}</p>

      {feedback && <p className="mb-2 text-xs text-amber-400">{feedback}</p>}

      {activity.type === "quiz" ? (
        <div className="mb-3 space-y-3">
          {questions.length > 0 && (() => {
            const q = questions[pageIndex];
            const mineIdx = state.myQuizAnswers[q.id];
            const answered = mineIdx !== undefined;
            const revealed = q.status === "revealed" && q.revealed_correct_index !== null;
            return (
              <div key={q.id}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Pergunta {pageIndex + 1} de {questions.length}
                </p>
                <p className="mb-2 text-sm font-medium">{q.prompt}</p>
                {revealed ? (
                  <div className="space-y-1 text-sm">
                    <p className="text-emerald-400">
                      ✓ Correta: {q.options[q.revealed_correct_index!]}
                    </p>
                    {answered && (
                      <p
                        className={
                          mineIdx === q.revealed_correct_index
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        {mineIdx === q.revealed_correct_index
                          ? "Você acertou!"
                          : `Você respondeu: ${q.options[mineIdx]}`}
                      </p>
                    )}
                  </div>
                ) : q.status === "open" ? (
                  <div className="space-y-2">
                    {q.options.map((option, i) => {
                      const chosen = mineIdx === i;
                      return (
                        <button
                          key={i}
                          onClick={() => answerQuiz(q, i)}
                          disabled={busy || answered}
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
                    {answered && (
                      <p className="text-xs text-neutral-400">
                        Resposta registrada! Aguarde o resultado.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    {answered ? "Você respondeu. " : ""}Aguardando resultado…
                  </p>
                )}
                {questions.length > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPage(pageIndex - 1)}
                      disabled={pageIndex === 0}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={() => setPage(pageIndex + 1)}
                      disabled={pageIndex >= questions.length - 1}
                      className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition disabled:opacity-30 ${
                        answered && pageIndex < questions.length - 1
                          ? "bg-[var(--brand,#0284c7)] text-white"
                          : "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                      }`}
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          {questions.length === 0 && (
            <p className="text-xs text-neutral-500">
              As perguntas aparecem quando o apresentador abrir a rodada.
            </p>
          )}
        </div>
      ) : activity.type === "quiz_ranking" ? null : activity.type === "scale" ? (
        <div className="mb-3 space-y-3">
          {isOpen && mine.length === 0 ? (
            <>
              {(activity.config.min_label || activity.config.max_label) && (
                <p className="text-xs text-neutral-500">
                  1 = {activity.config.min_label || "mínimo"} · {scaleMax} ={" "}
                  {activity.config.max_label || "máximo"}
                </p>
              )}
              {statements.length > 1 && (
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Afirmação {Math.min(scalePage, statements.length - 1) + 1} de{" "}
                  {statements.length}
                </p>
              )}
              {(() => {
                const i = Math.min(scalePage, statements.length - 1);
                const isLast = i === statements.length - 1;
                return (
                  <>
                    <div>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span>{statements[i]}</span>
                        <span className="font-mono tabular-nums text-[var(--brand,#38bdf8)]">
                          {ratings[i]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={scaleMax}
                        step={1}
                        value={ratings[i]}
                        onChange={(e) =>
                          setRatings((cur) =>
                            cur.map((v, j) =>
                              j === i ? Number(e.target.value) : v,
                            ),
                          )
                        }
                        className="w-full accent-[var(--brand,#0284c7)]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setScalePage(i - 1)}
                        disabled={i === 0}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
                      >
                        ← Anterior
                      </button>
                      {isLast ? (
                        <button
                          onClick={() => submit({ ratings })}
                          disabled={busy}
                          className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Enviar avaliação
                        </button>
                      ) : (
                        <button
                          onClick={() => setScalePage(i + 1)}
                          className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-1.5 text-sm font-semibold text-white"
                        >
                          Próxima →
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          ) : mine.length > 0 ? (
            <p className="text-xs text-neutral-400">Avaliação registrada!</p>
          ) : null}
        </div>
      ) : activity.type === "open_text" ? (
        <>
          {isOpen && mine.length < maxEntries && (
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) submit({ text: text.trim() });
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                placeholder="Escreva sua resposta…"
                className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Enviar
              </button>
            </form>
          )}
          {isOpen && (
            <p className="mb-3 text-xs text-neutral-500">
              {mine.length}/{maxEntries} envio{maxEntries === 1 ? "" : "s"}
              {mine.some((r) => !r.approved) && " (aguardando moderação)"}
            </p>
          )}
        </>
      ) : activity.type === "matrix" ? (
        <div className="mb-3 space-y-3">
          {isOpen && mine.length === 0 ? (
            <>
              {orderOptions.length > 1 && (
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Item {Math.min(scalePage, orderOptions.length - 1) + 1} de{" "}
                  {orderOptions.length}
                </p>
              )}
              {(() => {
                const i = Math.min(scalePage, orderOptions.length - 1);
                const isLast = i === orderOptions.length - 1;
                const axes: {
                  label: string;
                  values: number[];
                  set: React.Dispatch<React.SetStateAction<number[]>>;
                }[] = [
                  {
                    label: activity.config.x_label || "Eixo X",
                    values: xs,
                    set: setXs,
                  },
                  {
                    label: activity.config.y_label || "Eixo Y",
                    values: ys,
                    set: setYs,
                  },
                ];
                return (
                  <>
                    <p className="text-sm font-medium">{orderOptions[i]}</p>
                    {axes.map((axis) => (
                      <div key={axis.label}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-neutral-400">
                          <span>{axis.label}</span>
                          <span className="font-mono tabular-nums text-[var(--brand,#38bdf8)]">
                            {axis.values[i]}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={scaleMax}
                          step={1}
                          value={axis.values[i]}
                          onChange={(e) =>
                            axis.set((cur) =>
                              cur.map((v, j) =>
                                j === i ? Number(e.target.value) : v,
                              ),
                            )
                          }
                          className="w-full accent-[var(--brand,#0284c7)]"
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setScalePage(i - 1)}
                        disabled={i === 0}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
                      >
                        ← Anterior
                      </button>
                      {isLast ? (
                        <button
                          onClick={() => submit({ xs, ys })}
                          disabled={busy}
                          className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Enviar avaliação
                        </button>
                      ) : (
                        <button
                          onClick={() => setScalePage(i + 1)}
                          className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-1.5 text-sm font-semibold text-white"
                        >
                          Próxima →
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          ) : mine.length > 0 ? (
            <p className="text-xs text-neutral-400">Avaliação registrada!</p>
          ) : null}
        </div>
      ) : activity.type === "ordering" ? (
        <div className="mb-3 space-y-2">
          {isOpen && mine.length === 0 ? (
            <>
              <p className="text-xs text-neutral-500">
                Use as setas para ordenar do mais importante para o menos.
              </p>
              {order.map((optIdx, pos) => (
                <div
                  key={optIdx}
                  className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                >
                  <span className="w-5 text-right font-mono text-neutral-500">
                    {pos + 1}.
                  </span>
                  <span className="min-w-0 flex-1">{orderOptions[optIdx]}</span>
                  <button
                    onClick={() => moveItem(pos, -1)}
                    disabled={pos === 0}
                    aria-label="Subir"
                    className="rounded px-2 py-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveItem(pos, 1)}
                    disabled={pos === order.length - 1}
                    aria-label="Descer"
                    className="rounded px-2 py-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              ))}
              <button
                onClick={() => submit({ order })}
                disabled={busy}
                className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Enviar ordem
              </button>
            </>
          ) : mine.length > 0 ? (
            <p className="text-xs text-neutral-400">Ordem registrada!</p>
          ) : null}
        </div>
      ) : activity.type === "word_cloud" ? (
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
        activity.type === "quiz" ? (
          // por pergunta o resultado já está nas páginas acima; aqui só o ranking
          (results?.ranking?.length ?? 0) > 0 && (
            <RankingList rows={results?.ranking ?? []} screen={false} />
          )
        ) : (
          <ActivityResultsView activity={activity} results={results} />
        )
      ) : (
        <p className="text-xs text-neutral-500">
          O resultado aparece quando o apresentador exibir.
        </p>
      )}
    </div>
  );
}

/** Aba "Interação" da sala: uma atividade por vez, com paginação. */
export function InteractionPanel({ state }: { state: ActivitiesState }) {
  const [page, setPage] = useState(0);
  const acts = state.activities;
  const openId = state.open?.id;

  // Atividade aberta ao vivo → vira a página atual
  useEffect(() => {
    if (!openId) return;
    const i = acts.findIndex((a) => a.id === openId);
    if (i >= 0) setPage(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  if (acts.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-neutral-500">
        Nenhuma atividade no momento. Fique de olho!
      </p>
    );
  }

  const idx = Math.min(page, acts.length - 1);
  const current = acts[idx];

  return (
    <div className="flex h-full flex-col p-4">
      {acts.length > 1 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setPage(idx - 1)}
            disabled={idx === 0}
            aria-label="Atividade anterior"
            className="rounded-lg border border-neutral-700 px-2.5 py-1 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
          >
            ←
          </button>
          <span className="text-xs text-neutral-500">
            Atividade {idx + 1} de {acts.length}
          </span>
          <button
            onClick={() => setPage(idx + 1)}
            disabled={idx >= acts.length - 1}
            aria-label="Próxima atividade"
            className="rounded-lg border border-neutral-700 px-2.5 py-1 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ActivityCard key={current.id} activity={current} state={state} />
      </div>
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
