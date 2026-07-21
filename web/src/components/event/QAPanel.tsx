"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EventQuestion, LiveEvent } from "@/lib/types";

interface QAPanelProps {
  event: LiveEvent;
  userId: string;
}

/** Aba "Perguntas": envio (identificado ou anônimo), upvote e ordenação por votos. */
export function QAPanel({ event, userId }: QAPanelProps) {
  const ended = event.status === "ended";
  const supabase = useMemo(() => createClient(), []);
  const [questions, setQuestions] = useState<EventQuestion[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: qs }, { data: votes }] = await Promise.all([
      supabase
        .from("questions")
        .select("*")
        .eq("event_id", event.id)
        .order("votes_count", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("question_votes").select("question_id").eq("user_id", userId),
    ]);
    setQuestions((qs as EventQuestion[]) ?? []);
    setMyVotes(new Set((votes ?? []).map((v) => v.question_id)));
  }, [supabase, event.id, userId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`qa:${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions", filter: `event_id=eq.${event.id}` },
        () => load(),
      )
      .subscribe();
    const interval = setInterval(load, 10_000); // salvaguarda p/ eventos filtrados pelo RLS
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, event.id, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.rpc("submit_question", {
      p_event_id: event.id,
      p_content: text.trim(),
      p_anonymous: anonymous,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes("bloqueada")) setFeedback("Essa pergunta não é permitida.");
      else if (msg.includes("inscritos")) setFeedback("Só participantes inscritos podem perguntar.");
      else setFeedback(`Não foi possível enviar (${msg}).`);
    } else {
      setText("");
      setFeedback("Pergunta enviada! Ela aparece depois que a moderação aprovar.");
      await load();
    }
    setBusy(false);
  }

  async function vote(question: EventQuestion) {
    // otimista
    const had = myVotes.has(question.id);
    setMyVotes((prev) => {
      const next = new Set(prev);
      if (had) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === question.id
          ? { ...q, votes_count: q.votes_count + (had ? -1 : 1) }
          : q,
      ),
    );
    const { error } = await supabase.rpc("toggle_question_vote", {
      p_question_id: question.id,
    });
    if (error) await load();
  }

  const mine = questions.filter(
    (q) => q.author_id === userId && q.status === "pending",
  );
  const listed = questions.filter((q) =>
    q.status === "visible" || q.status === "answered"
      ? true
      : q.author_id === userId && q.status === "pending",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {listed.length === 0 && (
          <p className="pt-8 text-center text-[13px] text-neutral-500">
            Nenhuma pergunta ainda. Mande a sua!
          </p>
        )}
        {listed.map((q) => {
          const voted = myVotes.has(q.id);
          const isMinePending = q.status === "pending";
          return (
            <div
              key={q.id}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${
                q.status === "answered"
                  ? "border-emerald-900 bg-emerald-950/20"
                  : "border-neutral-800"
              } ${isMinePending ? "opacity-60" : ""}`}
            >
              {event.qa_upvote_enabled && (
                <button
                  onClick={() => vote(q)}
                  disabled={isMinePending || ended}
                  aria-label={voted ? "Retirar voto" : "Votar nesta pergunta"}
                  className={`flex shrink-0 flex-col items-center rounded-lg border px-2 py-1 text-xs transition ${
                    voted
                      ? "border-[var(--brand,#0284c7)] bg-[var(--brand,#0284c7)]/20 text-white"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  <ChevronUp className="size-3.5" />
                  <span className="font-mono tabular-nums">{q.votes_count}</span>
                </button>
              )}
              <div className="min-w-0">
                <p className="break-words text-[13px] leading-snug text-neutral-200">
                  {q.content}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {q.is_anonymous ? "Anônimo" : q.author_name || "Participante"}
                  {q.status === "answered" && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald-400">
                      <Check className="size-3" /> respondida
                    </span>
                  )}
                  {isMinePending && " · aguardando moderação"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {ended ? (
        <p className="border-t border-neutral-800 p-3 text-center text-[13px] text-neutral-500">
          Este evento foi encerrado — não é mais possível enviar perguntas.
        </p>
      ) : (
      <form onSubmit={submit} className="border-t border-neutral-800 p-2">
        {feedback && <p className="mb-1.5 text-xs text-amber-400">{feedback}</p>}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Faça sua pergunta…"
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[13px] outline-none placeholder:text-neutral-500 focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="rounded-lg bg-[var(--brand,#0284c7)] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
        {event.qa_allow_anonymous && (
          <label className="mt-1.5 flex items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-3.5 w-3.5 accent-sky-500"
            />
            Perguntar como anônimo
          </label>
        )}
        {mine.length > 0 && !feedback && (
          <p className="mt-1.5 text-xs text-neutral-500">
            Você tem {mine.length} pergunta{mine.length === 1 ? "" : "s"} na
            moderação.
          </p>
        )}
      </form>
      )}
    </div>
  );
}
