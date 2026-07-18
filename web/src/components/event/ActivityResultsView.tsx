"use client";

import type { Activity, ActivityResults, RankingRow } from "@/lib/types";

interface ActivityResultsViewProps {
  activity: Pick<Activity, "type" | "config">;
  results: ActivityResults | null;
  /** "panel" = aba/overlay da sala e diretor · "screen" = telão OBS */
  size?: "panel" | "screen";
}

/** Paleta para as palavras da nuvem (alterna com a cor da marca via --brand). */
const CLOUD_COLORS = [
  "var(--brand, #38bdf8)",
  "#f2f2f0",
  "#a3a3a3",
  "#fbbf24",
  "#34d399",
];

/** Visualização anônima de resultados: nuvem de palavras ou barras de enquete. */
export function ActivityResultsView({
  activity,
  results,
  size = "panel",
}: ActivityResultsViewProps) {
  const screen = size === "screen";

  if (!results || results.total === 0) {
    return (
      <p
        className={
          screen
            ? "text-center text-2xl text-neutral-400"
            : "text-sm text-neutral-500"
        }
      >
        Aguardando respostas…
      </p>
    );
  }

  if (activity.type === "word_cloud") {
    // no painel a nuvem é compacta (o telão mostra a versão completa)
    const words = (results.words ?? []).slice(0, screen ? 80 : 30);
    const max = Math.max(...words.map((w) => w.count), 1);
    const minSize = screen ? 1.4 : 0.8;
    const maxSize = screen ? 5 : 1.9;
    return (
      <div
        className={`flex flex-wrap items-center justify-center ${
          screen ? "gap-x-8 gap-y-3" : "gap-x-4 gap-y-1.5"
        }`}
      >
        {words.map((w, i) => (
          <span
            key={w.word}
            className="font-semibold leading-tight transition-all duration-700"
            style={{
              fontSize: `${minSize + (maxSize - minSize) * (w.count / max)}rem`,
              color: CLOUD_COLORS[i % CLOUD_COLORS.length],
              opacity: 0.55 + 0.45 * (w.count / max),
            }}
            title={`${w.count}×`}
          >
            {w.word}
          </span>
        ))}
      </div>
    );
  }

  if (activity.type === "quiz") {
    const questions = results.questions ?? [];
    const ranking = results.ranking ?? [];
    return (
      <div className={screen ? "space-y-8" : "space-y-4"}>
        {questions.map((q) => (
          <div key={q.id}>
            <p
              className={`mb-2 font-medium ${screen ? "text-3xl" : "text-sm"}`}
            >
              {q.prompt}
              {q.correct_count !== null && (
                <span
                  className={`ml-2 font-normal text-emerald-400 ${
                    screen ? "text-2xl" : "text-xs"
                  }`}
                >
                  {q.correct_count} de {q.total} acertaram
                </span>
              )}
            </p>
            <div className={screen ? "space-y-3" : "space-y-2"}>
              {q.options.map((option, i) => {
                const count = q.counts[i] ?? 0;
                const pct = q.total > 0 ? Math.round((count / q.total) * 100) : 0;
                const isCorrect = q.correct_index === i;
                return (
                  <div key={i}>
                    <div
                      className={`mb-0.5 flex items-baseline justify-between gap-4 ${
                        screen ? "text-xl" : "text-xs"
                      } ${isCorrect ? "font-semibold text-emerald-400" : ""}`}
                    >
                      <span>
                        {isCorrect && "✓ "}
                        {option}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-neutral-400">
                        {pct}% · {count}
                      </span>
                    </div>
                    <div
                      className={`overflow-hidden rounded-full bg-neutral-800 ${
                        screen ? "h-4" : "h-2"
                      }`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isCorrect
                            ? "bg-emerald-500"
                            : q.correct_index !== null
                              ? "bg-neutral-600"
                              : "bg-[var(--brand,#38bdf8)]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {ranking.length > 0 && <RankingList rows={ranking} screen={screen} />}
        <p className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}>
          {results.total} participante{results.total === 1 ? "" : "s"}
        </p>
      </div>
    );
  }

  if (activity.type === "scale") {
    const statements = results.statements ?? [];
    const scaleMax = results.scale_max ?? activity.config.scale_max ?? 5;
    const minLabel = activity.config.min_label;
    const maxLabel = activity.config.max_label;
    return (
      <div className={screen ? "space-y-7" : "space-y-4"}>
        {(minLabel || maxLabel) && (
          <p className={`text-neutral-400 ${screen ? "text-xl" : "text-xs"}`}>
            1 = {minLabel || "mínimo"} · {scaleMax} = {maxLabel || "máximo"}
          </p>
        )}
        {statements.map((s, i) => {
          const pct = s.avg !== null ? ((s.avg - 1) / (scaleMax - 1)) * 100 : 0;
          return (
            <div key={i}>
              <div
                className={`mb-1 flex items-baseline justify-between gap-4 ${
                  screen ? "text-2xl" : "text-sm"
                }`}
              >
                <span className="font-medium">{s.statement}</span>
                <span className="shrink-0 font-mono text-lg tabular-nums text-[var(--brand,#38bdf8)]">
                  {s.avg !== null ? s.avg.toFixed(1) : "—"}
                </span>
              </div>
              {/* régua com marcador na média */}
              <div
                className={`relative rounded-full bg-neutral-800 ${
                  screen ? "h-4" : "h-2.5"
                }`}
              >
                <div
                  className="h-full rounded-full bg-[var(--brand,#38bdf8)]/40 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
                {s.avg !== null && (
                  <div
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand,#38bdf8)] transition-all duration-700 ${
                      screen ? "h-7 w-7" : "h-4 w-4"
                    }`}
                    style={{ left: `${pct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
        <p className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}>
          {results.total} resposta{results.total === 1 ? "" : "s"}
        </p>
      </div>
    );
  }

  if (activity.type === "open_text") {
    const entries = results.entries ?? [];
    const spotlight = results.spotlight ?? null;
    const all = spotlight
      ? entries.filter((e) => e.id !== spotlight.id)
      : entries;
    // painel mostra as mais recentes; o restante fica no telão/CSV
    const rest = screen ? all : all.slice(0, 8);
    const hidden = all.length - rest.length;
    return (
      <div className={screen ? "space-y-8" : "space-y-3"}>
        {spotlight && (
          <blockquote
            className={`rounded-xl border border-[var(--brand,#38bdf8)]/50 bg-neutral-900/80 font-medium leading-snug ${
              screen ? "p-8 text-center text-4xl" : "p-4 text-base"
            }`}
          >
            “{spotlight.text}”
          </blockquote>
        )}
        <div
          className={`flex flex-wrap ${screen ? "justify-center gap-4" : "gap-2"}`}
        >
          {rest.map((e) => (
            <span
              key={e.id}
              className={`rounded-xl border border-neutral-700 bg-neutral-900 leading-snug ${
                screen ? "px-5 py-3 text-2xl" : "px-3 py-1.5 text-sm"
              }`}
            >
              {e.text}
            </span>
          ))}
        </div>
        <p className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}>
          {results.total} resposta{results.total === 1 ? "" : "s"}
          {hidden > 0 && ` · mostrando as ${rest.length} mais recentes`}
        </p>
      </div>
    );
  }

  if (activity.type === "ordering") {
    const items = results.order ?? [];
    const n = items.length || 1;
    return (
      <div className={screen ? "space-y-4" : "space-y-2"}>
        {items.map((item, i) => {
          // menor posição média = mais bem ranqueado = barra maior
          const strength =
            item.avg_pos !== null ? 1 - (item.avg_pos - 1) / Math.max(1, n - 1) : 0;
          return (
            <div key={item.index}>
              <div
                className={`mb-0.5 flex items-baseline justify-between gap-4 ${
                  screen ? "text-2xl" : "text-sm"
                } ${i === 0 ? "font-semibold" : ""}`}
              >
                <span>
                  <span className="mr-2 font-mono text-neutral-500">{i + 1}.</span>
                  {item.option}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-neutral-400">
                  {item.avg_pos !== null ? `média ${item.avg_pos.toFixed(1)}` : "—"}
                </span>
              </div>
              <div
                className={`overflow-hidden rounded-full bg-neutral-800 ${
                  screen ? "h-4" : "h-2"
                }`}
              >
                <div
                  className="h-full rounded-full bg-[var(--brand,#38bdf8)] transition-all duration-700"
                  style={{ width: `${Math.round(20 + strength * 80)}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}>
          {results.total} resposta{results.total === 1 ? "" : "s"}
        </p>
      </div>
    );
  }

  if (activity.type === "quiz_ranking") {
    return (
      <div className={screen ? "space-y-6" : "space-y-3"}>
        <RankingList rows={results.ranking ?? []} screen={screen} podium />
        <p className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}>
          {results.total} participante{results.total === 1 ? "" : "s"} pontuaram
        </p>
      </div>
    );
  }

  // poll: barras com % ao vivo
  const options = activity.config.options ?? [];
  const counts = results.counts ?? [];
  return (
    <div className={screen ? "space-y-5" : "space-y-3"}>
      {options.map((option, i) => {
        const count = counts[i] ?? 0;
        const pct = results.total > 0 ? Math.round((count / results.total) * 100) : 0;
        return (
          <div key={i}>
            <div
              className={`mb-1 flex items-baseline justify-between gap-4 ${
                screen ? "text-2xl" : "text-sm"
              }`}
            >
              <span className="font-medium">{option}</span>
              <span className="shrink-0 font-mono tabular-nums text-neutral-400">
                {pct}% · {count}
              </span>
            </div>
            <div
              className={`overflow-hidden rounded-full bg-neutral-800 ${
                screen ? "h-5" : "h-2.5"
              }`}
            >
              <div
                className="h-full rounded-full bg-[var(--brand,#38bdf8)] transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p
        className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}
      >
        {results.total} voto{results.total === 1 ? "" : "s"}
      </p>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Lista de classificação (do quiz ou geral da live). */
export function RankingList({
  rows,
  screen,
  podium = false,
}: {
  rows: RankingRow[];
  screen: boolean;
  podium?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className={screen ? "text-center text-2xl text-neutral-400" : "text-sm text-neutral-500"}>
        Ninguém pontuou ainda.
      </p>
    );
  }
  return (
    <div>
      {!podium && (
        <h4
          className={`mb-2 font-semibold uppercase tracking-wide text-neutral-400 ${
            screen ? "text-xl" : "text-xs"
          }`}
        >
          Ranking
        </h4>
      )}
      <ol className={screen ? "space-y-3" : "space-y-1.5"}>
        {rows.map((row, i) => (
          <li
            key={`${row.name}-${i}`}
            className={`flex items-center justify-between gap-4 ${
              screen
                ? podium && i === 0
                  ? "text-4xl font-bold"
                  : "text-2xl"
                : `text-sm ${i === 0 ? "font-semibold" : ""}`
            }`}
          >
            <span className="min-w-0 truncate">
              <span
                className={`mr-2 inline-block text-right font-mono text-neutral-500 ${
                  screen ? "w-10" : "w-6"
                }`}
              >
                {podium && i < 3 ? MEDALS[i] : `${i + 1}.`}
              </span>
              {row.name || "Participante"}
            </span>
            <span className="shrink-0 font-mono tabular-nums">
              {row.score}
              <span
                className={`ml-2 text-neutral-500 ${screen ? "text-lg" : "text-xs"}`}
              >
                {row.correct} acerto{row.correct === 1 ? "" : "s"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
