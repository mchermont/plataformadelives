"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Activity,
  ActivityResponse,
  ActivityResults,
  ActivityType,
  QuizQuestion,
} from "@/lib/types";
import { ACTIVITY_STATUS_LABELS, ACTIVITY_TYPE_LABELS } from "@/lib/types";

const TYPE_ICONS: Record<ActivityType, string> = {
  word_cloud: "☁️",
  poll: "📊",
  quiz: "🎯",
  quiz_ranking: "🏆",
};
import { ActivityResultsView } from "@/components/event/ActivityResultsView";

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

interface ResponseRow extends ActivityResponse {
  profiles: { full_name: string; email: string } | null;
}

/** CSV compatível com Excel pt-BR (separador ; e BOM UTF-8). */
function downloadCsv(filename: string, rows: string[][]) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const body = rows.map((row) => row.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Action = "open" | "close" | "publish" | "unpublish" | "clear";

/** Bloco "Atividades interativas" do painel Diretor (Fase E.1). */
export function ActivityManager({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [results, setResults] = useState<Record<string, ActivityResults>>({});
  const [queue, setQueue] = useState<ResponseRow[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // formulário de nova pergunta (quiz expandido)
  const [qPrompt, setQPrompt] = useState("");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState(0);
  const [qBusy, setQBusy] = useState(false);

  // formulário de nova atividade
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<ActivityType>("word_cloud");
  const [title, setTitle] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [highlight, setHighlight] = useState(true);
  const [liveResults, setLiveResults] = useState(true);
  const [moderation, setModeration] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("event_id", eventId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    const list = (data as Activity[]) ?? [];
    setActivities(list);

    // resultados das atividades em andamento (contador + preview ao vivo)
    const active = list.filter((a) => a.status !== "pending");
    const entries = await Promise.all(
      active.map(async (a) => {
        const { data: r } = await supabase.rpc("get_activity_results", {
          p_activity_id: a.id,
        });
        return [a.id, r as ActivityResults] as const;
      }),
    );
    setResults(Object.fromEntries(entries.filter(([, r]) => r)));

    // perguntas dos quizzes (inclui pendentes — o diretor vê a fila do lote)
    const quizActs = list.filter((a) => a.type === "quiz" && a.quiz_id);
    if (quizActs.length > 0) {
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("*")
        .in("quiz_id", quizActs.map((a) => a.quiz_id as string))
        .order("position", { ascending: true });
      const byActivity: Record<string, QuizQuestion[]> = {};
      for (const a of quizActs) {
        byActivity[a.id] = ((qs as QuizQuestion[]) ?? []).filter(
          (q) => q.quiz_id === a.quiz_id,
        );
      }
      setQuizQuestions(byActivity);
    } else {
      setQuizQuestions({});
    }

    // fila de moderação (respostas pendentes de aprovação)
    const moderated = list.filter((a) => a.require_moderation);
    if (moderated.length > 0) {
      const { data: pend } = await supabase
        .from("activity_responses")
        .select("*, profiles(full_name, email)")
        .in("activity_id", moderated.map((a) => a.id))
        .eq("approved", false)
        .order("created_at", { ascending: true });
      setQueue((pend as ResponseRow[]) ?? []);
    } else {
      setQueue([]);
    }
  }, [supabase, eventId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-activities:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities", filter: `event_id=eq.${eventId}` },
        () => load(),
      )
      .subscribe();
    const interval = setInterval(load, 3000); // contadores ao vivo
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, eventId, load]);

  async function createActivity() {
    const options = optionsText
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    if (!title.trim()) {
      setError("Escreva a pergunta/título da atividade.");
      return;
    }
    if (type === "poll" && options.length < 2) {
      setError("A enquete precisa de pelo menos 2 opções (uma por linha).");
      return;
    }
    setBusy(true);
    setError(null);

    // quiz vive na tabela quizzes (perguntas/gabarito/pontuação)
    let quizId: string | null = null;
    if (type === "quiz") {
      const { data: quiz, error: quizErr } = await supabase
        .from("quizzes")
        .insert({ event_id: eventId, title: title.trim() })
        .select()
        .single();
      if (quizErr || !quiz) {
        setError(`Não foi possível criar o quiz (${quizErr?.message}).`);
        setBusy(false);
        return;
      }
      quizId = quiz.id;
    }

    const { data: created, error: err } = await supabase
      .from("activities")
      .insert({
        event_id: eventId,
        type,
        title: title.trim(),
        quiz_id: quizId,
        config:
          type === "poll" ? { options } : type === "word_cloud" ? { max_entries: 3 } : {},
        // quiz revela gabarito só no "Exibir resultado"; ranking geral é sempre ao vivo
        results_visible:
          type === "quiz" ? "after_publish" : type === "quiz_ranking" ? "live" : liveResults ? "live" : "after_publish",
        highlight,
        require_moderation: type === "word_cloud" ? moderation : false,
        position: activities.length,
      })
      .select()
      .single();
    if (err) {
      if (quizId) await supabase.from("quizzes").delete().eq("id", quizId);
      setError(`Não foi possível criar a atividade (${err.message}).`);
    } else {
      setTitle("");
      setOptionsText("");
      setShowForm(false);
      if (created && type === "quiz") setExpanded(created.id); // já abre p/ adicionar perguntas
      await load();
    }
    setBusy(false);
  }

  async function addQuestion(activity: Activity) {
    if (!activity.quiz_id) return;
    const cleanOptions = qOptions.map((o) => o.trim()).filter(Boolean);
    if (!qPrompt.trim() || cleanOptions.length < 2) {
      setError("Escreva a pergunta e pelo menos 2 alternativas.");
      return;
    }
    if (qCorrect >= cleanOptions.length) {
      setError("A alternativa correta precisa estar preenchida.");
      return;
    }
    setQBusy(true);
    setError(null);
    const existing = quizQuestions[activity.id] ?? [];
    const { data: question, error: qErr } = await supabase
      .from("quiz_questions")
      .insert({
        quiz_id: activity.quiz_id,
        prompt: qPrompt.trim(),
        options: cleanOptions,
        time_limit_sec: 0, // sem cronômetro: a pergunta fecha com o lote
        position: existing.length,
      })
      .select()
      .single();
    if (qErr || !question) {
      setError("Não foi possível criar a pergunta.");
      setQBusy(false);
      return;
    }
    const { error: kErr } = await supabase
      .from("quiz_keys")
      .insert({ question_id: question.id, correct_index: qCorrect });
    if (kErr) {
      await supabase.from("quiz_questions").delete().eq("id", question.id);
      setError("Não foi possível salvar o gabarito. Tente de novo.");
    } else {
      setQPrompt("");
      setQOptions(["", "", "", ""]);
      setQCorrect(0);
      await load();
    }
    setQBusy(false);
  }

  async function removeQuestion(id: string) {
    await supabase.from("quiz_questions").delete().eq("id", id);
    await load();
  }

  async function control(id: string, action: Action) {
    setError(null);
    const { error: err } = await supabase.rpc("activity_control", {
      p_activity_id: id,
      p_action: action,
    });
    if (err) setError(err.message);
    await load();
  }

  async function removeActivity(activity: Activity) {
    if (!confirm("Excluir esta atividade e todas as respostas?")) return;
    if (activity.type === "quiz" && activity.quiz_id) {
      // apagar o quiz cascateia perguntas, respostas e a própria atividade
      await supabase.from("quizzes").delete().eq("id", activity.quiz_id);
    } else {
      await supabase.from("activities").delete().eq("id", activity.id);
    }
    await load();
  }

  async function moderate(response: ResponseRow, approve: boolean) {
    if (approve) {
      await supabase
        .from("activity_responses")
        .update({ approved: true })
        .eq("id", response.id);
    } else {
      await supabase.from("activity_responses").delete().eq("id", response.id);
    }
    await load();
  }

  async function exportCsv(activity: Activity) {
    if (activity.type === "quiz" && activity.quiz_id) {
      const questions = quizQuestions[activity.id] ?? [];
      const { data } = await supabase
        .from("quiz_answers")
        .select("*, profiles(full_name, email)")
        .in("question_id", questions.map((q) => q.id))
        .order("answered_at", { ascending: true });
      type AnswerRow = {
        question_id: string;
        selected_index: number;
        answered_at: string;
        profiles: { full_name: string; email: string } | null;
      };
      const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
      downloadCsv(`quiz-${activity.id.slice(0, 8)}.csv`, [
        ["Nome", "E-mail", "Pergunta", "Resposta", "Correta", "Respondida em"],
        ...((data as AnswerRow[]) ?? []).map((a) => {
          const q = byId[a.question_id];
          return [
            a.profiles?.full_name ?? "",
            a.profiles?.email ?? "",
            q?.prompt ?? "",
            q?.options[a.selected_index] ?? String(a.selected_index),
            q?.revealed_correct_index == null
              ? "—"
              : a.selected_index === q.revealed_correct_index
                ? "Sim"
                : "Não",
            new Date(a.answered_at).toLocaleString("pt-BR"),
          ];
        }),
      ]);
      return;
    }
    if (activity.type === "quiz_ranking") {
      const { data } = await supabase
        .from("quiz_leaderboard")
        .select("*")
        .eq("event_id", eventId)
        .order("score", { ascending: false });
      downloadCsv(`ranking-geral-${eventId.slice(0, 8)}.csv`, [
        ["Posição", "Nome", "Acertos", "Pontuação"],
        ...((data as { full_name: string; correct_count: number; score: number }[]) ?? []).map(
          (row, i) => [
            String(i + 1),
            row.full_name,
            String(row.correct_count),
            String(row.score),
          ],
        ),
      ]);
      return;
    }
    const { data } = await supabase
      .from("activity_responses")
      .select("*, profiles(full_name, email)")
      .eq("activity_id", activity.id)
      .order("created_at", { ascending: true });
    const rows = (data as ResponseRow[]) ?? [];
    const options = activity.config.options ?? [];
    downloadCsv(`atividade-${activity.type}-${activity.id.slice(0, 8)}.csv`, [
      ["Nome", "E-mail", "Resposta", "Aprovada", "Enviada em"],
      ...rows.map((r) => [
        r.profiles?.full_name ?? "",
        r.profiles?.email ?? "",
        activity.type === "word_cloud"
          ? (r.payload.word ?? "")
          : (options[r.payload.option_index ?? -1] ?? ""),
        r.approved ? "Sim" : "Não",
        new Date(r.created_at).toLocaleString("pt-BR"),
      ]),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            {showForm ? "Fechar" : "+ Nova atividade"}
          </button>
        </div>
        <a
          href={`/telao/${eventId}`}
          target="_blank"
          className="text-sm text-neutral-400 underline-offset-2 hover:text-white hover:underline"
        >
          🖥 Abrir telão (OBS) ↗
        </a>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="space-y-3 rounded-xl border border-neutral-800 p-4">
          <div className="flex gap-2">
            {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  type === t
                    ? "border-sky-500 bg-sky-950/50 font-semibold text-sky-300"
                    : "border-neutral-700 text-neutral-400 hover:text-white"
                }`}
              >
                {TYPE_ICONS[t]} {ACTIVITY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === "word_cloud"
                ? "Ex.: Em uma palavra, o que você espera do evento?"
                : type === "poll"
                  ? "Pergunta da enquete"
                  : type === "quiz"
                    ? "Nome do quiz (as perguntas você adiciona depois)"
                    : "Título do telão (ex.: Grande campeão da live)"
            }
            className={inputClass}
          />
          {type === "poll" && (
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={4}
              placeholder={"Uma opção por linha\nOpção A\nOpção B"}
              className={inputClass}
            />
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={highlight}
                onChange={(e) => setHighlight(e.target.checked)}
                className="h-4 w-4 accent-sky-500"
              />
              Destaque (overlay sobre o vídeo)
            </label>
            {(type === "word_cloud" || type === "poll") && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={liveResults}
                  onChange={(e) => setLiveResults(e.target.checked)}
                  className="h-4 w-4 accent-sky-500"
                />
                Resultado em tempo real p/ participantes
              </label>
            )}
            {type === "word_cloud" && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={moderation}
                  onChange={(e) => setModeration(e.target.checked)}
                  className="h-4 w-4 accent-sky-500"
                />
                Aprovar palavras antes de exibir
              </label>
            )}
          </div>
          <button
            onClick={createActivity}
            disabled={busy}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Salvando…" : "Criar atividade"}
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Fila de moderação ({queue.length})
          </h3>
          <ul className="space-y-2">
            {queue.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <strong>{r.payload.word}</strong>
                  <span className="ml-2 text-xs text-neutral-500">
                    {r.profiles?.full_name || r.profiles?.email}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => moderate(r, true)}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    ✓ Aprovar
                  </button>
                  <button
                    onClick={() => moderate(r, false)}
                    className="rounded-lg border border-red-900 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-950"
                  >
                    ✕ Remover
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activities.length === 0 && !showForm && (
        <p className="text-sm text-neutral-500">
          Nenhuma atividade ainda. Crie uma nuvem de palavras ou enquete e
          abra ao vivo durante a transmissão.
        </p>
      )}

      <div className="space-y-3">
        {activities.map((a) => {
          const r = results[a.id];
          const isExpanded = expanded === a.id;
          const qs = quizQuestions[a.id] ?? [];
          const pendingCount = qs.filter((q) => q.status === "pending").length;
          return (
            <div
              key={a.id}
              className={`rounded-xl border p-4 ${
                a.status === "open" ? "border-emerald-800" : "border-neutral-800"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {TYPE_ICONS[a.type]} {a.title}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {ACTIVITY_TYPE_LABELS[a.type]}
                    {a.type === "quiz" &&
                      ` · ${qs.length} pergunta${qs.length === 1 ? "" : "s"}${
                        pendingCount > 0 ? ` (${pendingCount} na fila)` : ""
                      }`}
                    {a.highlight && " · destaque"}
                    {a.require_moderation && " · moderada"}
                    {a.results_visible === "after_publish" &&
                      " · resultado só ao exibir"}
                    {a.type !== "quiz_ranking" && (
                      <>
                        {" — "}
                        {r?.total ?? 0}{" "}
                        {a.type === "quiz" ? "participante" : "resposta"}
                        {(r?.total ?? 0) === 1 ? "" : "s"}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      a.status === "open"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : a.status === "closed"
                          ? "bg-neutral-800 text-neutral-300"
                          : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {ACTIVITY_STATUS_LABELS[a.status]}
                    {a.results_published && " · exibido"}
                  </span>
                  {a.status !== "open" && (
                    <button
                      onClick={() => control(a.id, "open")}
                      disabled={a.type === "quiz" && pendingCount === 0}
                      title={
                        a.type === "quiz" && pendingCount === 0
                          ? "Adicione perguntas novas antes de abrir outra rodada"
                          : undefined
                      }
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      ▶ Abrir
                      {a.type === "quiz" && pendingCount > 0
                        ? ` ${pendingCount} pergunta${pendingCount === 1 ? "" : "s"}`
                        : ""}
                    </button>
                  )}
                  {a.status === "open" && (
                    <button
                      onClick={() => control(a.id, "close")}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                    >
                      ■ Fechar
                    </button>
                  )}
                  {a.status !== "pending" &&
                    (a.results_published ? (
                      <button
                        onClick={() => control(a.id, "unpublish")}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800"
                      >
                        Ocultar resultado
                      </button>
                    ) : (
                      <button
                        onClick={() => control(a.id, "publish")}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                      >
                        ✓ Exibir resultado
                      </button>
                    ))}
                  {a.status !== "pending" && (
                    <button
                      onClick={() => control(a.id, "clear")}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
                      title="Apaga as respostas e volta para a fila"
                    >
                      Limpar
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : a.id)}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
                  >
                    {isExpanded ? "Esconder" : a.type === "quiz" ? "Perguntas" : "Prévia"}
                  </button>
                  <button
                    onClick={() => exportCsv(a)}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
                  >
                    ⬇ CSV
                  </button>
                  {a.status === "pending" && (
                    <button
                      onClick={() => removeActivity(a)}
                      className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && a.type === "quiz" && (
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    {qs.length === 0 && (
                      <p className="text-sm text-neutral-500">
                        Nenhuma pergunta ainda — adicione abaixo. Você pode
                        lançar em rodadas: abra com algumas perguntas, feche,
                        adicione mais e abra de novo.
                      </p>
                    )}
                    {qs.map((q, i) => (
                      <div
                        key={q.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {i + 1}. {q.prompt}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {q.options.join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              q.status === "open"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : q.status === "revealed"
                                  ? "bg-sky-500/15 text-sky-400"
                                  : q.status === "closed"
                                    ? "bg-neutral-800 text-neutral-300"
                                    : "bg-neutral-800 text-neutral-500"
                            }`}
                          >
                            {q.status === "pending"
                              ? "Na fila"
                              : q.status === "open"
                                ? "Aberta"
                                : q.status === "closed"
                                  ? "Fechada"
                                  : "Revelada"}
                          </span>
                          {q.status === "pending" && (
                            <button
                              onClick={() => removeQuestion(q.id)}
                              className="text-xs text-red-400 underline-offset-2 hover:underline"
                            >
                              excluir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="max-w-xl space-y-3 rounded-lg border border-neutral-800 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Nova pergunta (entra na fila da próxima rodada)
                    </h4>
                    <input
                      value={qPrompt}
                      onChange={(e) => setQPrompt(e.target.value)}
                      placeholder="Enunciado da pergunta"
                      className={inputClass}
                    />
                    {qOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correta-${a.id}`}
                          checked={qCorrect === i}
                          onChange={() => setQCorrect(i)}
                          title="Marcar como correta"
                          className="h-4 w-4 accent-emerald-500"
                        />
                        <input
                          value={opt}
                          onChange={(e) =>
                            setQOptions((os) =>
                              os.map((o, j) => (j === i ? e.target.value : o)),
                            )
                          }
                          placeholder={`Alternativa ${String.fromCharCode(65 + i)}${i < 2 ? " *" : " (opcional)"}`}
                          className={inputClass}
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-neutral-500">
                        A bolinha marca a correta. O gabarito só aparece quando
                        você exibir o resultado.
                      </p>
                      <button
                        onClick={() => addQuestion(a)}
                        disabled={qBusy}
                        className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
                      >
                        {qBusy ? "Salvando…" : "Adicionar"}
                      </button>
                    </div>
                  </div>

                  {a.status !== "pending" && (
                    <div className="rounded-lg bg-neutral-950 p-4">
                      <ActivityResultsView activity={a} results={r ?? null} />
                    </div>
                  )}
                </div>
              )}
              {isExpanded && a.type !== "quiz" && (
                <div className="mt-4 rounded-lg bg-neutral-950 p-4">
                  <ActivityResultsView activity={a} results={r ?? null} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-500">
        Só uma atividade fica aberta por vez — abrir uma fecha a anterior. O
        telão mostra a atividade atual em tela cheia para compor no OBS/vMix
        (fundos: <code>?bg=transparent</code>, <code>?bg=green</code>,{" "}
        <code>?bg=dark</code> ou <code>?bg=art</code>).
      </p>
    </div>
  );
}
