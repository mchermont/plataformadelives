"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Quiz, QuizQuestion, QuizStatus } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

const QUIZ_STATUS_LABELS: Record<QuizStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  closed: "Encerrado",
};

export function QuizManager({
  eventId,
  isAdmin,
}: {
  eventId: string;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [newQuizTitle, setNewQuizTitle] = useState("");

  // formulário de nova pergunta
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [timeLimit, setTimeLimit] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuizzes = useCallback(async () => {
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    const list = (data as Quiz[]) ?? [];
    setQuizzes(list);
    setSelected((cur) => cur ?? list[0]?.id ?? null);
  }, [supabase, eventId]);

  const loadQuestions = useCallback(async () => {
    if (!selected) return;
    const [{ data: qs }, { data: answers }] = await Promise.all([
      supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", selected)
        .order("position", { ascending: true }),
      supabase
        .from("quiz_answers")
        .select("question_id"),
    ]);
    setQuestions((qs as QuizQuestion[]) ?? []);
    const counts: Record<string, number> = {};
    for (const a of answers ?? []) {
      counts[a.question_id] = (counts[a.question_id] ?? 0) + 1;
    }
    setAnswerCounts(counts);
  }, [supabase, selected]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    loadQuestions();
    if (!selected) return;
    const channel = supabase
      .channel(`admin-quiz:${selected}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_questions", filter: `quiz_id=eq.${selected}` },
        () => loadQuestions(),
      )
      .subscribe();
    const interval = setInterval(loadQuestions, 5000); // contagem de respostas
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, selected, loadQuestions]);

  async function createQuiz() {
    if (!newQuizTitle.trim()) return;
    const { data } = await supabase
      .from("quizzes")
      .insert({ event_id: eventId, title: newQuizTitle.trim() })
      .select()
      .single();
    setNewQuizTitle("");
    await loadQuizzes();
    if (data) setSelected(data.id);
  }

  async function setQuizStatus(status: QuizStatus) {
    if (!selected) return;
    await supabase.from("quizzes").update({ status }).eq("id", selected);
    await loadQuizzes();
  }

  async function addQuestion() {
    if (!selected) return;
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!prompt.trim() || cleanOptions.length < 2) {
      setError("Escreva a pergunta e pelo menos 2 alternativas.");
      return;
    }
    if (correct >= cleanOptions.length) {
      setError("A alternativa correta precisa estar preenchida.");
      return;
    }
    setBusy(true);
    setError(null);

    const { data: question, error: qError } = await supabase
      .from("quiz_questions")
      .insert({
        quiz_id: selected,
        prompt: prompt.trim(),
        options: cleanOptions,
        time_limit_sec: timeLimit,
        position: questions.length,
      })
      .select()
      .single();

    if (qError || !question) {
      setError("Não foi possível criar a pergunta.");
      setBusy(false);
      return;
    }

    const { error: kError } = await supabase
      .from("quiz_keys")
      .insert({ question_id: question.id, correct_index: correct });

    if (kError) {
      await supabase.from("quiz_questions").delete().eq("id", question.id);
      setError("Não foi possível salvar o gabarito. Tente de novo.");
    } else {
      setPrompt("");
      setOptions(["", "", "", ""]);
      setCorrect(0);
      await loadQuestions();
    }
    setBusy(false);
  }

  async function control(questionId: string, fn: "open_question" | "close_question" | "reveal_question") {
    await supabase.rpc(fn, { p_question_id: questionId });
  }

  const quiz = quizzes.find((q) => q.id === selected);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end gap-3">
        {quizzes.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">Quiz</label>
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
              className={inputClass}
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} — {QUIZ_STATUS_LABELS[q.status]}
                </option>
              ))}
            </select>
          </div>
        )}
        {isAdmin && (
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Novo quiz</label>
              <input
                value={newQuizTitle}
                onChange={(e) => setNewQuizTitle(e.target.value)}
                placeholder="Título do quiz"
                className={inputClass}
              />
            </div>
            <button
              onClick={createQuiz}
              disabled={!newQuizTitle.trim()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Criar
            </button>
          </div>
        )}
      </section>

      {quiz && (
        <>
          <section className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">
              Status: <strong className="text-neutral-200">{QUIZ_STATUS_LABELS[quiz.status]}</strong>
            </span>
            {quiz.status === "draft" && isAdmin && (
              <button
                onClick={() => setQuizStatus("active")}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Ativar (participantes passam a ver)
              </button>
            )}
            {quiz.status === "active" && isAdmin && (
              <button
                onClick={() => setQuizStatus("closed")}
                className="rounded-lg border border-neutral-700 px-4 py-1.5 text-sm font-semibold hover:bg-neutral-800"
              >
                Encerrar quiz
              </button>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Perguntas
            </h2>
            {questions.length === 0 && (
              <p className="text-sm text-neutral-500">Nenhuma pergunta ainda.</p>
            )}
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-neutral-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {i + 1}. {q.prompt}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {q.options.join(" · ")} — {q.time_limit_sec}s —{" "}
                      {answerCounts[q.id] ?? 0} resposta(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        q.status === "open"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : q.status === "revealed"
                            ? "bg-sky-500/15 text-sky-400"
                            : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {q.status === "pending"
                        ? "Aguardando"
                        : q.status === "open"
                          ? "Aberta"
                          : q.status === "closed"
                            ? "Fechada"
                            : "Revelada"}
                    </span>
                    {q.status === "pending" && quiz.status === "active" && (
                      <button
                        onClick={() => control(q.id, "open_question")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        ▶ Abrir ao vivo
                      </button>
                    )}
                    {q.status === "open" && (
                      <button
                        onClick={() => control(q.id, "close_question")}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                      >
                        ■ Fechar
                      </button>
                    )}
                    {q.status === "closed" && (
                      <button
                        onClick={() => control(q.id, "reveal_question")}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                      >
                        ✓ Revelar resposta
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </section>

          {isAdmin && (
          <section className="max-w-xl space-y-4 rounded-xl border border-neutral-800 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Nova pergunta
            </h2>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enunciado da pergunta"
              className={inputClass}
            />
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correta"
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                  title="Marcar como correta"
                  className="h-4 w-4 accent-emerald-500"
                />
                <input
                  value={opt}
                  onChange={(e) =>
                    setOptions((os) => os.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`Alternativa ${String.fromCharCode(65 + i)}${i < 2 ? " *" : " (opcional)"}`}
                  className={inputClass}
                />
              </div>
            ))}
            <div className="flex items-end justify-between gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tempo (segundos)</label>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value) || 30)}
                  className={inputClass}
                />
              </div>
              <button
                onClick={addQuestion}
                disabled={busy}
                className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
              >
                {busy ? "Salvando…" : "Adicionar pergunta"}
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              A bolinha marca a alternativa correta. O gabarito fica visível só
              para admins até você revelar.
            </p>
          </section>
          )}
        </>
      )}
    </div>
  );
}
