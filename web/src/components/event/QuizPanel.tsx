"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaderboardRow, Quiz, QuizQuestion } from "@/lib/types";

interface QuizPanelProps {
  eventId: string;
  userId: string;
}

export function QuizPanel({ eventId, userId }: QuizPanelProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [myAnswers, setMyAnswers] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const loadAll = useCallback(async () => {
    const supabase = supabaseRef.current;

    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["active", "closed"])
      .order("created_at", { ascending: false })
      .limit(1);
    const activeQuiz = (quizzes?.[0] as Quiz) ?? null;
    setQuiz(activeQuiz);

    if (activeQuiz) {
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", activeQuiz.id)
        .neq("status", "pending")
        .order("position", { ascending: true });
      setQuestions((qs as QuizQuestion[]) ?? []);

      const { data: answers } = await supabase
        .from("quiz_answers")
        .select("*")
        .eq("user_id", userId);
      const map: Record<string, number> = {};
      for (const a of answers ?? []) map[a.question_id] = a.selected_index;
      setMyAnswers(map);
    }

    const { data: board } = await supabase
      .from("quiz_leaderboard")
      .select("*")
      .eq("event_id", eventId)
      .order("score", { ascending: false })
      .limit(10);
    setLeaderboard((board as LeaderboardRow[]) ?? []);
  }, [eventId, userId]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    loadAll();

    // Qualquer mudança em quiz/perguntas do evento → recarrega o estado
    const channel = supabase
      .channel(`quiz:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_questions" },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quizzes", filter: `event_id=eq.${eventId}` },
        () => loadAll(),
      )
      .subscribe();

    const tick = setInterval(() => setNow(Date.now()), 500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [eventId, loadAll]);

  async function answer(question: QuizQuestion, index: number) {
    if (myAnswers[question.id] !== undefined) return;
    setFeedback(null);
    // otimista
    setMyAnswers((prev) => ({ ...prev, [question.id]: index }));
    const { error } = await supabaseRef.current.rpc("answer_question", {
      p_question_id: question.id,
      p_selected: index,
    });
    if (error) {
      setMyAnswers((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
      setFeedback(
        error.message.includes("Tempo") ? "Tempo esgotado!" : "Não foi possível registrar a resposta.",
      );
    }
  }

  function secondsLeft(q: QuizQuestion): number {
    if (!q.opened_at) return 0;
    const end = new Date(q.opened_at).getTime() + q.time_limit_sec * 1000;
    return Math.max(0, Math.ceil((end - now) / 1000));
  }

  const open = questions.find((q) => q.status === "open");
  const past = questions.filter((q) => q.status !== "open");

  if (!quiz) {
    return (
      <p className="p-6 text-center text-sm text-neutral-500">
        Nenhum quiz ativo no momento. Fique de olho!
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <h3 className="font-semibold">{quiz.title}</h3>

      {feedback && <p className="text-xs text-amber-400">{feedback}</p>}

      {open && (
        <div className="rounded-xl border border-sky-800 bg-sky-950/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-400">
              Pergunta ao vivo
            </span>
            <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 font-mono text-sm tabular-nums text-sky-300">
              {secondsLeft(open)}s
            </span>
          </div>
          <p className="mb-3 font-medium">{open.prompt}</p>
          <div className="space-y-2">
            {open.options.map((option, i) => {
              const chosen = myAnswers[open.id] === i;
              const answered = myAnswers[open.id] !== undefined;
              return (
                <button
                  key={i}
                  onClick={() => answer(open, i)}
                  disabled={answered || secondsLeft(open) === 0}
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
          </div>
          {myAnswers[open.id] !== undefined && (
            <p className="mt-3 text-xs text-neutral-400">
              Resposta registrada! Aguarde o resultado.
            </p>
          )}
        </div>
      )}

      {past.map((q) => {
        const mine = myAnswers[q.id];
        return (
          <div key={q.id} className="rounded-xl border border-neutral-800 p-4">
            <p className="mb-2 text-sm font-medium text-neutral-300">{q.prompt}</p>
            {q.status === "revealed" && q.revealed_correct_index !== null ? (
              <div className="space-y-1 text-sm">
                <p className="text-emerald-400">
                  ✓ Correta: {q.options[q.revealed_correct_index]}
                </p>
                {mine !== undefined && (
                  <p className={mine === q.revealed_correct_index ? "text-emerald-400" : "text-red-400"}>
                    {mine === q.revealed_correct_index
                      ? "Você acertou!"
                      : `Você respondeu: ${q.options[mine]}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                {mine !== undefined ? "Você respondeu. " : ""}Aguardando resultado…
              </p>
            )}
          </div>
        );
      })}

      {leaderboard.length > 0 && (
        <div className="rounded-xl border border-neutral-800 p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Ranking
          </h4>
          <ol className="space-y-1.5">
            {leaderboard.map((row, i) => (
              <li
                key={row.user_id}
                className={`flex items-center justify-between text-sm ${
                  row.user_id === userId ? "font-semibold text-sky-300" : ""
                }`}
              >
                <span>
                  <span className="mr-2 inline-block w-5 text-right font-mono text-neutral-500">
                    {i + 1}.
                  </span>
                  {row.full_name || "Participante"}
                </span>
                <span className="font-mono tabular-nums">{row.score}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
