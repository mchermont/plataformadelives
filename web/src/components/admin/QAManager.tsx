"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronUp, Download, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EventQuestion } from "@/lib/types";

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

interface QuestionRow extends EventQuestion {
  profiles: { full_name: string; email: string } | null;
}

type Sort = "votes" | "recent";

/** Painel do apresentador: fila de moderação, votos, respondida, export. */
export function QAManager({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [sort, setSort] = useState<Sort>("votes");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select("*, profiles(full_name, email)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setQuestions((data as QuestionRow[]) ?? []);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-qa:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions", filter: `event_id=eq.${eventId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, load]);

  async function setStatus(q: EventQuestion, status: EventQuestion["status"]) {
    await supabase.from("questions").update({ status }).eq("id", q.id);
    await load();
  }

  async function remove(q: EventQuestion) {
    if (!confirm("Apagar esta pergunta?")) return;
    await supabase.from("questions").delete().eq("id", q.id);
    await load();
  }

  function exportCsv() {
    downloadCsv(`perguntas-${eventId.slice(0, 8)}.csv`, [
      ["Nome", "E-mail", "Anônima na tela", "Pergunta", "Votos", "Status", "Enviada em"],
      ...questions.map((q) => [
        q.profiles?.full_name ?? "",
        q.profiles?.email ?? "",
        q.is_anonymous ? "Sim" : "Não",
        q.content,
        String(q.votes_count),
        q.status === "pending"
          ? "Na moderação"
          : q.status === "visible"
            ? "Publicada"
            : q.status === "answered"
              ? "Respondida"
              : "Rejeitada",
        new Date(q.created_at).toLocaleString("pt-BR"),
      ]),
    ]);
  }

  const pending = questions.filter((q) => q.status === "pending");
  const listed = questions
    .filter((q) => q.status === "visible" || q.status === "answered")
    .sort((a, b) =>
      sort === "votes"
        ? b.votes_count - a.votes_count ||
          b.created_at.localeCompare(a.created_at)
        : b.created_at.localeCompare(a.created_at),
    );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 p-2">
        <div className="flex gap-1">
          {(["votes", "recent"] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-lg px-2.5 py-1 text-xs ${
                sort === s
                  ? "bg-neutral-800 font-semibold text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {s === "votes" ? "Mais votadas" : "Recentes"}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          disabled={questions.length === 0}
          className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-800 disabled:opacity-40"
        >
          <Download className="size-3.5" /> CSV
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {pending.length > 0 && (
          <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-2.5">
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
              Fila de moderação ({pending.length})
            </h4>
            <div className="space-y-1.5">
              {pending.map((q) => (
                <div key={q.id} className="text-[13px]">
                  <p className="break-words text-neutral-200">{q.content}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">
                      {q.profiles?.full_name || "Participante"}
                      {q.is_anonymous && " (pediu anonimato)"}
                    </span>
                    <button
                      onClick={() => setStatus(q, "visible")}
                      className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                    >
                      <Check className="size-3" /> Aprovar
                    </button>
                    <button
                      onClick={() => setStatus(q, "rejected")}
                      className="flex items-center gap-1 rounded border border-red-900 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-950"
                    >
                      <X className="size-3" /> Rejeitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {listed.length === 0 && pending.length === 0 && (
          <p className="pt-8 text-center text-[13px] text-neutral-500">
            Nenhuma pergunta ainda.
          </p>
        )}

        {listed.map((q) => (
          <div
            key={q.id}
            className={`group rounded-lg border p-2.5 ${
              q.status === "answered"
                ? "border-emerald-900 bg-emerald-950/20"
                : "border-neutral-800"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="flex shrink-0 flex-col items-center rounded-lg border border-neutral-700 px-2 py-1 text-center text-xs text-neutral-300">
                <ChevronUp className="size-3.5" />
                <span className="font-mono tabular-nums">{q.votes_count}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13px] leading-snug text-neutral-200">
                  {q.content}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {q.is_anonymous
                    ? `Anônimo (${q.profiles?.full_name || "?"})`
                    : q.author_name || "Participante"}
                  {" · "}
                  {new Date(q.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {q.status === "visible" ? (
                <button
                  onClick={() => setStatus(q, "answered")}
                  className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                >
                  <Check className="size-3" /> Respondida
                </button>
              ) : (
                <button
                  onClick={() => setStatus(q, "visible")}
                  className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] hover:bg-neutral-800"
                >
                  Reabrir
                </button>
              )}
              <button
                onClick={() => remove(q)}
                className="flex items-center gap-1 rounded border border-red-900 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-950"
              >
                <Trash2 className="size-3" /> Apagar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
