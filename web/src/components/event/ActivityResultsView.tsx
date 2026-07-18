"use client";

import type { Activity, ActivityResults } from "@/lib/types";

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
    const words = results.words ?? [];
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
