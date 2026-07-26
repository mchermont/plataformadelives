"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Quote } from "lucide-react";
import type { Activity, ActivityResults, RankingRow } from "@/lib/types";

interface ActivityResultsViewProps {
  activity: Pick<Activity, "type" | "config">;
  results: ActivityResults | null;
  /** "panel" = aba/overlay da sala e diretor · "screen" = telão OBS */
  size?: "panel" | "screen";
}

/**
 * Paleta vivida pra distinguir itens de uma mesma atividade (palavras,
 * opções, pontos do mapa). Só hues que NÃO foram desaturados pro tema onix
 * em globals.css (sky/purple/neutral viraram grafite quente) — emerald,
 * amber, rose etc. continuam o padrão vivo do Tailwind, com fallback hex
 * pro caso raro de `var()` não resolver (ex.: fora de um documento).
 */
const VIVID_PALETTE = [
  "var(--color-emerald-400, #34d399)",
  "var(--color-amber-400, #fbbf24)",
  "var(--color-rose-400, #fb7185)",
  "var(--color-violet-400, #a78bfa)",
  "var(--color-cyan-400, #22d3ee)",
  "var(--color-orange-400, #fb923c)",
  "var(--color-fuchsia-400, #e879f9)",
  "var(--color-lime-400, #a3e635)",
];

/** Classes Tailwind equivalentes à paleta acima, na mesma ordem — pra barras/fundos que precisam de className em vez de style inline. */
const VIVID_BAR_CLASSES = [
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-violet-400",
  "bg-cyan-400",
  "bg-orange-400",
  "bg-fuchsia-400",
  "bg-lime-400",
];

interface CloudWord {
  word: string;
  count: number;
  size: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
}

let measureCanvas: HTMLCanvasElement | null = null;

/**
 * Empacota as palavras tipo nuvem de verdade (Mentimeter-style): maiores
 * (mais votadas) primeiro, posicionadas por espiral a partir do centro até
 * achar um espaço livre — não é uma lista em `flex-wrap`, é colisão real
 * medida via Canvas 2D (`measureText`), por isso só roda no client depois
 * de medir o container (não dá pra fazer isso no SSR).
 */
function packWordCloud(
  words: { word: string; count: number }[],
  width: number,
  height: number,
  minSize: number,
  maxSize: number
): CloudWord[] {
  if (!width || !height || words.length === 0) return [];

  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return [];

  const fontFamily =
    getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim() || "sans-serif";

  const max = Math.max(...words.map((w) => w.count), 1);
  const sized = [...words]
    .sort((a, b) => b.count - a.count)
    .map((w) => ({ ...w, size: minSize + (maxSize - minSize) * (w.count / max) }));

  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const out: CloudWord[] = [];

  sized.forEach((w, i) => {
    ctx.font = `800 ${w.size}px ${fontFamily}`;
    const textWidth = ctx.measureText(w.word).width;
    // leve rotação em algumas palavras pra sensação orgânica, maioria
    // horizontal (legibilidade continua sendo prioridade sobre estilo)
    const rotate = i % 9 === 4 ? -18 : i % 13 === 7 ? 18 : 0;
    const rotated = rotate !== 0;
    const boxW = (rotated ? textWidth * 0.94 + w.size * 0.4 : textWidth) + w.size * 0.32;
    const boxH = (rotated ? textWidth * 0.5 : w.size * 1.15) + w.size * 0.24;

    let x = cx - boxW / 2;
    let y = cy - boxH / 2;
    let angle = (i * 137.5 * Math.PI) / 180; // ângulo dourado — evita padrão repetitivo entre palavras
    let radius = 0;
    let attempts = 0;
    const maxAttempts = 2000;

    while (attempts < maxAttempts) {
      const candidateX = cx + radius * Math.cos(angle) * 1.15 - boxW / 2;
      const candidateY = cy + radius * Math.sin(angle) * 0.75 - boxH / 2;
      const withinBounds =
        candidateX >= 0 && candidateY >= 0 && candidateX + boxW <= width && candidateY + boxH <= height;
      const overlaps = placed.some(
        (p) => candidateX < p.x + p.w && candidateX + boxW > p.x && candidateY < p.y + p.h && candidateY + boxH > p.y
      );
      if (withinBounds && !overlaps) {
        x = candidateX;
        y = candidateY;
        break;
      }
      angle += 0.3;
      radius += 2.6;
      attempts++;
    }

    placed.push({ x, y, w: boxW, h: boxH });
    out.push({
      word: w.word,
      count: w.count,
      size: w.size,
      x: x + boxW / 2,
      y: y + boxH / 2,
      rotate,
      color: VIVID_PALETTE[i % VIVID_PALETTE.length],
    });
  });

  return out;
}

/** Nuvem de palavras com layout real (posições/tamanhos/cores variadas), medida via ResizeObserver no container. */
function WordCloud({ words, screen }: { words: { word: string; count: number }[]; screen: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [layout, setLayout] = useState<CloudWord[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const minSize = screen ? 1.5 : 0.85;
    const maxSize = screen ? 5.5 : 2.1;
    setLayout(packWordCloud(words, size.width, size.height, minSize, maxSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, size.width, size.height, screen]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${screen ? "h-[62vh] min-h-[420px]" : "h-56 sm:h-64"}`}
    >
      {layout.map((w) => (
        <span
          key={w.word}
          className="absolute font-extrabold leading-none transition-all duration-700 ease-out"
          style={{
            left: w.x,
            top: w.y,
            transform: `translate(-50%, -50%) rotate(${w.rotate}deg)`,
            fontSize: `${w.size}rem`,
            color: w.color,
          }}
          title={`${w.count}×`}
        >
          {w.word}
        </span>
      ))}
    </div>
  );
}

/** Visualização anônima de resultados: nuvem de palavras ou barras de enquete. */
export function ActivityResultsView({ activity, results, size = "panel" }: ActivityResultsViewProps) {
  const screen = size === "screen";

  if (!results || results.total === 0) {
    return (
      <p className={screen ? "text-center text-2xl text-neutral-400" : "text-sm text-neutral-500"}>
        Aguardando respostas…
      </p>
    );
  }

  if (activity.type === "word_cloud") {
    // no painel a nuvem é compacta (o telão mostra a versão completa)
    const words = (results.words ?? []).slice(0, screen ? 80 : 30);
    return <WordCloud words={words} screen={screen} />;
  }

  if (activity.type === "quiz") {
    const questions = results.questions ?? [];
    const ranking = results.ranking ?? [];
    return (
      <div className={screen ? "space-y-8" : "space-y-4"}>
        {questions.map((q) => (
          <div key={q.id}>
            <p className={`mb-2 font-medium ${screen ? "text-3xl" : "text-sm"}`}>
              {q.prompt}
              {q.correct_count !== null && (
                <span className={`ml-2 font-normal text-emerald-400 ${screen ? "text-2xl" : "text-xs"}`}>
                  {q.correct_count} de {q.total} acertaram
                </span>
              )}
            </p>
            <div className={screen ? "space-y-3" : "space-y-2"}>
              {q.options.map((option, i) => {
                const count = q.counts[i] ?? 0;
                const pct = q.total > 0 ? Math.round((count / q.total) * 100) : 0;
                const isCorrect = q.correct_index === i;
                const revealed = q.correct_index !== null;
                const barColor = revealed
                  ? isCorrect
                    ? "bg-emerald-400"
                    : "bg-neutral-700"
                  : VIVID_BAR_CLASSES[i % VIVID_BAR_CLASSES.length];
                return (
                  <div key={i}>
                    <div
                      className={`mb-0.5 flex items-baseline justify-between gap-4 ${
                        screen ? "text-xl" : "text-xs"
                      } ${isCorrect ? "font-semibold text-emerald-400" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {isCorrect && <Check className="size-3.5 shrink-0" />}
                        {option}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-neutral-400">
                        {pct}% · {count}
                      </span>
                    </div>
                    <div
                      className={`overflow-hidden rounded-full bg-neutral-800 ${screen ? "h-4" : "h-2"} ${
                        isCorrect ? "shadow-[0_0_16px_-2px_var(--color-emerald-400)]" : ""
                      }`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
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
              <div className={`mb-1 flex items-baseline justify-between gap-4 ${screen ? "text-2xl" : "text-sm"}`}>
                <span className="font-medium">{s.statement}</span>
                <span className="shrink-0 font-mono text-lg tabular-nums text-[var(--brand,#38bdf8)]">
                  {s.avg !== null ? s.avg.toFixed(1) : "—"}
                </span>
              </div>
              {/* régua com marcador na média */}
              <div className={`relative rounded-full bg-neutral-800 ${screen ? "h-4" : "h-2.5"}`}>
                <div
                  className="h-full rounded-full bg-[var(--brand,#38bdf8)]/40 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
                {s.avg !== null && (
                  <div
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand,#38bdf8)] shadow-[0_0_12px_-1px_var(--brand,#38bdf8)] transition-all duration-700 ${
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
    const all = spotlight ? entries.filter((e) => e.id !== spotlight.id) : entries;
    // painel mostra as mais recentes; o restante fica no telão/CSV
    const rest = screen ? all : all.slice(0, 8);
    const hidden = all.length - rest.length;
    return (
      <div className={screen ? "space-y-8" : "space-y-3"}>
        {spotlight && (
          <blockquote
            className={`relative rounded-xl border border-[var(--brand,#38bdf8)]/50 bg-neutral-900/80 font-medium leading-snug ${
              screen ? "p-10 text-center text-4xl" : "p-4 pl-9 text-base"
            }`}
          >
            <Quote
              className={`absolute text-[var(--brand,#38bdf8)]/40 ${
                screen ? "left-4 top-4 size-8" : "left-3 top-3.5 size-4"
              }`}
              fill="currentColor"
            />
            {spotlight.text}
          </blockquote>
        )}
        <div className={`flex flex-wrap ${screen ? "justify-center gap-4" : "gap-2"}`}>
          {rest.map((e, i) => (
            <span
              key={e.id}
              className={`rounded-xl border bg-neutral-900 leading-snug ${screen ? "px-5 py-3 text-2xl" : "px-3 py-1.5 text-sm"}`}
              style={{ borderColor: `color-mix(in oklch, ${VIVID_PALETTE[i % VIVID_PALETTE.length]} 45%, transparent)` }}
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
          const strength = item.avg_pos !== null ? 1 - (item.avg_pos - 1) / Math.max(1, n - 1) : 0;
          return (
            <div key={item.index}>
              <div
                className={`mb-0.5 flex items-baseline justify-between gap-4 ${screen ? "text-2xl" : "text-sm"} ${
                  i === 0 ? "font-semibold" : ""
                }`}
              >
                <span>
                  <span className="mr-2 font-mono text-neutral-500">{i + 1}.</span>
                  {item.option}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-neutral-400">
                  {item.avg_pos !== null ? `média ${item.avg_pos.toFixed(1)}` : "—"}
                </span>
              </div>
              <div className={`overflow-hidden rounded-full bg-neutral-800 ${screen ? "h-4" : "h-2"}`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${VIVID_BAR_CLASSES[i % VIVID_BAR_CLASSES.length]}`}
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

  if (activity.type === "matrix") {
    const items = results.items ?? [];
    const scaleMax = results.scale_max ?? activity.config.scale_max ?? 5;
    const pos = (v: number | null) => (v === null ? 50 : ((v - 1) / Math.max(1, scaleMax - 1)) * 100);
    return (
      <div className={screen ? "space-y-4" : "space-y-3"}>
        <div
          className={`relative mx-auto aspect-square w-full rounded-xl border border-neutral-800 bg-neutral-900/60 ${
            screen ? "max-w-[70vh]" : "max-w-72"
          }`}
        >
          {/* linhas centrais dos quadrantes */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-700" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-700" />
          {/* rótulos dos eixos */}
          <span className={`absolute bottom-1 right-2 text-neutral-500 ${screen ? "text-lg" : "text-[10px]"}`}>
            {activity.config.x_label || "eixo X"} →
          </span>
          <span className={`absolute left-2 top-1 text-neutral-500 ${screen ? "text-lg" : "text-[10px]"}`}>
            ↑ {activity.config.y_label || "eixo Y"}
          </span>
          {items.map((item, i) => (
            <div
              key={item.index}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
              style={{
                left: `${pos(item.avg_x)}%`,
                top: `${100 - pos(item.avg_y)}%`,
              }}
            >
              <div className="flex flex-col items-center">
                <span
                  className={`rounded-full ${screen ? "h-5 w-5" : "h-3 w-3"}`}
                  style={{
                    background: VIVID_PALETTE[i % VIVID_PALETTE.length],
                    boxShadow: `0 0 0 4px color-mix(in oklch, ${VIVID_PALETTE[i % VIVID_PALETTE.length]} 25%, transparent), 0 0 14px -2px ${VIVID_PALETTE[i % VIVID_PALETTE.length]}`,
                  }}
                />
                <span
                  className={`mt-0.5 max-w-32 truncate text-center font-medium ${screen ? "text-xl" : "text-[11px]"}`}
                >
                  {item.option}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}>
          {results.total} resposta{results.total === 1 ? "" : "s"} · posição = média dos votos (1–{scaleMax})
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
  const leadCount = Math.max(...counts, 0);
  return (
    <div className={screen ? "space-y-5" : "space-y-3"}>
      {options.map((option, i) => {
        const count = counts[i] ?? 0;
        const pct = results.total > 0 ? Math.round((count / results.total) * 100) : 0;
        const isLeading = count > 0 && count === leadCount;
        return (
          <div key={i}>
            <div
              className={`mb-1 flex items-baseline justify-between gap-4 ${screen ? "text-2xl" : "text-sm"} ${
                isLeading ? "font-semibold" : ""
              }`}
            >
              <span>{option}</span>
              <span className="shrink-0 font-mono tabular-nums text-neutral-400">
                {pct}% · {count}
              </span>
            </div>
            <div
              className={`overflow-hidden rounded-full bg-neutral-800 ${screen ? "h-5" : "h-2.5"}`}
              style={isLeading ? { boxShadow: `0 0 16px -2px ${VIVID_PALETTE[i % VIVID_PALETTE.length]}` } : undefined}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: VIVID_PALETTE[i % VIVID_PALETTE.length] }}
              />
            </div>
          </div>
        );
      })}
      <p className={`text-neutral-500 ${screen ? "text-xl" : "text-xs"}`}>
        {results.total} voto{results.total === 1 ? "" : "s"}
      </p>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = ["text-amber-400", "text-neutral-300", "text-orange-400"];

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
        <h4 className={`mb-2 font-semibold uppercase tracking-wide text-neutral-400 ${screen ? "text-xl" : "text-xs"}`}>
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
            } ${podium && i < 3 ? MEDAL_COLORS[i] : ""}`}
          >
            <span className="min-w-0 truncate">
              <span className={`mr-2 inline-block text-right font-mono text-neutral-500 ${screen ? "w-10" : "w-6"}`}>
                {podium && i < 3 ? MEDALS[i] : `${i + 1}.`}
              </span>
              {row.name || "Participante"}
            </span>
            <span className="shrink-0 font-mono tabular-nums">
              {row.score}
              <span className={`ml-2 text-neutral-500 ${screen ? "text-lg" : "text-xs"}`}>
                {row.correct} acerto{row.correct === 1 ? "" : "s"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
