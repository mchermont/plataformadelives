"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Raffle, RaffleKind, RaffleSource, RaffleWinner } from "@/lib/types";
import { RAFFLE_KIND_LABELS } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

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

function resultSummary(r: Raffle) {
  if (r.kind === "numbers") return (r.result as number[]).join(" · ");
  if (r.kind === "coin") return (r.result as string[])[0];
  return (r.result as RaffleWinner[]).map((w) => w.name).join(" · ");
}

/** Bloco "Sorteios" do Diretor: sortear, exibir no telão e auditar (Fase H). */
export function RaffleManager({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // formulário
  const [kind, setKind] = useState<RaffleKind>("participants");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<RaffleSource>("registrations");
  const [winners, setWinners] = useState(1);
  const [excludeTeam, setExcludeTeam] = useState(true);
  const [excludeWinners, setExcludeWinners] = useState(true);
  const [listText, setListText] = useState("");
  const [wheel, setWheel] = useState(false);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [count, setCount] = useState(1);
  const [excludeDrawn, setExcludeDrawn] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("raffles")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setRaffles((data as Raffle[]) ?? []);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function draw() {
    setBusy(true);
    setError(null);
    const config =
      kind === "participants"
        ? {
            source,
            winners,
            exclude_team: excludeTeam,
            exclude_winners: excludeWinners,
            ...(source === "list"
              ? {
                  list: listText
                    .split(/\r?\n|,/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              : {}),
          }
        : kind === "numbers"
          ? { min, max, count, exclude_drawn: excludeDrawn }
          : {};
    const { error: err } = await supabase.rpc("run_raffle", {
      p_event_id: eventId,
      p_kind: kind,
      p_title: title.trim(),
      p_config: config,
      p_visual: kind === "participants" && wheel ? "wheel" : "cards",
    });
    if (err) {
      setError(err.message);
    } else {
      setTitle("");
      setShowForm(false);
      await load();
    }
    setBusy(false);
  }

  async function display(r: Raffle, show: boolean) {
    setError(null);
    const { error: err } = await supabase.rpc("raffle_display", {
      p_raffle_id: r.id,
      p_show: show,
    });
    if (err) setError(err.message);
    await load();
  }

  async function remove(r: Raffle) {
    if (!confirm("Excluir este sorteio do histórico? O log de auditoria será perdido.")) return;
    await supabase.from("raffles").delete().eq("id", r.id);
    await load();
  }

  function exportAudit(r: Raffle) {
    const rows: string[][] = [
      ["Sorteio", r.title],
      ["Tipo", RAFFLE_KIND_LABELS[r.kind]],
      ["Data/hora", new Date(r.created_at).toLocaleString("pt-BR")],
      ["Semente", r.seed],
      [
        "Método",
        "ganhadores = menores valores de md5(semente || chave); reproduzível em qualquer ferramenta MD5",
      ],
      ["Configuração", JSON.stringify(r.config)],
      [],
      ["Resultado (em ordem)"],
      ...(r.kind === "participants"
        ? (r.result as RaffleWinner[]).map((w, i) => [String(i + 1), w.name, w.key])
        : (r.result as (number | string)[]).map((n, i) => [String(i + 1), String(n)])),
      [],
    ];
    if (r.kind === "participants") {
      rows.push(
        ["Elegíveis no momento do sorteio", String((r.entries as RaffleWinner[]).length)],
        ...(r.entries as RaffleWinner[]).map((e) => [e.name, e.key]),
      );
    } else if (r.kind === "numbers") {
      const e = r.entries as { min: number; max: number; excluded: number[] };
      rows.push(
        ["Intervalo", `${e.min} a ${e.max}`],
        ["Números excluídos (já sorteados)", e.excluded.join(" ") || "nenhum"],
      );
    }
    downloadCsv(`sorteio-${r.id.slice(0, 8)}.csv`, rows);
  }

  return (
    <div className="mt-6 rounded-xl border border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          🎲 Sorteios · auditáveis
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
        >
          {showForm ? "Fechar" : "+ Novo sorteio"}
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(RAFFLE_KIND_LABELS) as RaffleKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  kind === k
                    ? "bg-sky-600 font-semibold text-white"
                    : "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {RAFFLE_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ex.: Sorteio do brinde)"
            className={inputClass}
          />

          {kind === "participants" && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="text-neutral-400">Entre:</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as RaffleSource)}
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                >
                  <option value="registrations">Inscritos aprovados</option>
                  <option value="attendance">Presentes na sala agora</option>
                  <option value="list">Lista colada</option>
                </select>
                <label className="text-neutral-400">Ganhadores:</label>
                <input
                  type="number"
                  min={1}
                  value={winners}
                  onChange={(e) => setWinners(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                />
              </div>
              {source === "list" && (
                <textarea
                  value={listText}
                  onChange={(e) => setListText(e.target.value)}
                  rows={4}
                  placeholder={"Um nome por linha (ou separados por vírgula)"}
                  className={inputClass}
                />
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-neutral-300">
                {source !== "list" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={excludeTeam}
                      onChange={(e) => setExcludeTeam(e.target.checked)}
                      className="h-4 w-4 accent-sky-500"
                    />
                    Excluir a equipe
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={excludeWinners}
                    onChange={(e) => setExcludeWinners(e.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                  />
                  Excluir quem já ganhou nesta live
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wheel}
                    onChange={(e) => setWheel(e.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                  />
                  Visual de roleta no telão
                </label>
              </div>
            </>
          )}

          {kind === "numbers" && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="text-neutral-400">De</label>
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(Number(e.target.value) || 1)}
                className="w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
              />
              <label className="text-neutral-400">a</label>
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(Number(e.target.value) || 100)}
                className="w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
              />
              <label className="text-neutral-400">Quantidade:</label>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
              />
              <label className="flex items-center gap-2 text-neutral-300">
                <input
                  type="checkbox"
                  checked={excludeDrawn}
                  onChange={(e) => setExcludeDrawn(e.target.checked)}
                  className="h-4 w-4 accent-sky-500"
                />
                Sem repetir números já sorteados
              </label>
            </div>
          )}

          {kind === "coin" && (
            <p className="text-sm text-neutral-400">
              Cara ou coroa com moeda animada no telão — para decisões rápidas.
            </p>
          )}

          <button
            onClick={draw}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {busy ? "Sorteando…" : "🎲 Sortear agora"}
          </button>
        </div>
      )}

      {raffles.length === 0 && !showForm && (
        <p className="text-sm text-neutral-500">
          Nenhum sorteio ainda. Cada sorteio fica registrado com semente e
          elegíveis — prova de lisura exportável em CSV.
        </p>
      )}

      <div className="space-y-2">
        {raffles.map((r) => (
          <div
            key={r.id}
            className={`rounded-lg border p-3 ${
              r.displayed ? "border-sky-700 bg-sky-950/20" : "border-neutral-800"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{r.title}</span>
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">
                {RAFFLE_KIND_LABELS[r.kind]}
              </span>
              {r.displayed && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-400">
                  📺 No telão
                </span>
              )}
              <span className="ml-auto text-[11px] text-neutral-500">
                {new Date(r.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1 break-words text-sm text-emerald-400">
              🏆 {resultSummary(r)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => display(r, !r.displayed)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  r.displayed
                    ? "border border-neutral-700 hover:bg-neutral-800"
                    : "bg-sky-600 text-white hover:bg-sky-500"
                }`}
              >
                {r.displayed ? "Ocultar do telão" : "📺 Exibir no telão"}
              </button>
              <button
                onClick={() => exportAudit(r)}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
              >
                ⬇ Auditoria (CSV)
              </button>
              <button
                onClick={() => remove(r)}
                className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
