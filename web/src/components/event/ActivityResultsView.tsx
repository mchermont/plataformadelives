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
 * Empacota as palavras tipo nuvem (maiores primeiro, tamanho por
 * frequência, cores variadas) usando "prateleiras": cada palavra entra na
 * linha atual se couber, senão abre uma linha nova embaixo — cada linha é
 * centralizada e as linhas ficam centralizadas verticalmente no conjunto.
 * Diferente de uma busca por espiral/tentativa-e-erro (que já se provou
 * frágil aqui — várias rodadas ainda empilhavam palavra em cima de
 * palavra em casos que pareciam simples), esse método NUNCA sobrepõe: é
 * posicionamento sequencial, não uma heurística que pode falhar. Medição
 * real via Canvas 2D (`measureText`), por isso só roda no client depois
 * de medir o container.
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
  const measureWidth = (word: string, size: number) => {
    ctx.font = `800 ${size}px ${fontFamily}`;
    return ctx.measureText(word).width;
  };

  const max = Math.max(...words.map((w) => w.count), 1);
  const items = [...words]
    .sort((a, b) => b.count - a.count)
    .map((w) => {
      let size = minSize + (maxSize - minSize) * (w.count / max);
      const limit = width * 0.85;
      // Nenhuma palavra isolada pode ser mais larga que o container.
      const raw = measureWidth(w.word, size);
      if (raw + size * 0.4 > limit) size *= limit / (raw + size * 0.4);
      const boxW = measureWidth(w.word, size) + size * 0.4;
      const boxH = size * 1.35;
      return { word: w.word, count: w.count, size, boxW, boxH };
    });

  interface Row {
    items: typeof items;
    gaps: number[];
    height: number;
    width: number;
  }
  const rows: Row[] = [];
  let row: Row | null = null;

  items.forEach((item) => {
    const gap = item.size * 0.4;
    const extra = row && row.items.length > 0 ? gap : 0;
    if (!row || row.width + extra + item.boxW > width) {
      row = { items: [], gaps: [], height: 0, width: 0 };
      rows.push(row);
    }
    if (row.items.length > 0) {
      row.gaps.push(gap);
      row.width += gap;
    }
    row.items.push(item);
    row.width += item.boxW;
    row.height = Math.max(row.height, item.boxH);
  });

  const rowGap = Math.min(height * 0.03, 14);
  const totalHeight = rows.reduce((sum, r) => sum + r.height, 0) + rowGap * Math.max(0, rows.length - 1);
  // se as linhas juntas ficarem mais altas que o container, encolhe tudo
  // proporcionalmente — nunca deixa vazar pra fora, nunca sobrepõe.
  const scale = totalHeight > height ? height / totalHeight : 1;

  const out: CloudWord[] = [];
  let y = (height - totalHeight * scale) / 2;
  rows.forEach((r) => {
    const rowHeight = r.height * scale;
    let x = (width - r.width * scale) / 2;
    r.items.forEach((item, i) => {
      if (i > 0) x += r.gaps[i - 1] * scale;
      const w = item.boxW * scale;
      out.push({
        word: item.word,
        count: item.count,
        size: item.size * scale,
        x: x + w / 2,
        y: y + rowHeight / 2,
        rotate: 0,
        color: VIVID_PALETTE[out.length % VIVID_PALETTE.length],
      });
      x += w;
    });
    y += rowHeight + rowGap * scale;
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

/**
 * Linha-resultado: em vez de um rótulo com uma barrinha fininha embaixo, a
 * própria linha É a barra (preenchimento cresce da esquerda, cor tingindo o
 * cartão inteiro) — mesma linguagem visual em poll/quiz/ordering/scale, com
 * borda e brilho na opção líder. Sem side-stripe: o preenchimento cobre a
 * largura toda, não uma tarja lateral.
 */
function BarRow({
  label,
  icon,
  pct,
  meta,
  color,
  screen,
  leading = false,
  muted = false,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  pct: number;
  meta: string;
  color: string;
  screen: boolean;
  leading?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-700 ${
        screen ? "px-5 py-3.5" : "px-3.5 py-2.5"
      }`}
      style={{
        borderColor: muted ? "var(--color-neutral-800)" : `color-mix(in oklch, ${color} 42%, transparent)`,
        background: "var(--color-neutral-900)",
        boxShadow: leading
          ? `0 0 0 1px color-mix(in oklch, ${color} 60%, transparent), 0 10px 24px -14px ${color}`
          : undefined,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-all duration-700"
        style={{
          width: `${Math.max(pct, 2)}%`,
          background: muted ? "var(--color-neutral-800)" : `color-mix(in oklch, ${color} 24%, transparent)`,
        }}
      />
      <div
        className={`relative flex items-center justify-between gap-4 ${screen ? "text-2xl" : "text-sm"} ${
          leading ? "font-semibold" : "font-medium"
        } ${muted ? "text-neutral-400" : "text-neutral-100"}`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          {icon}
          {label}
        </span>
        <span
          className={`shrink-0 font-mono tabular-nums ${screen ? "text-xl" : "text-xs"} ${
            muted ? "text-neutral-500" : "text-neutral-300"
          }`}
        >
          {meta}
        </span>
      </div>
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
            <div className={screen ? "space-y-2.5" : "space-y-1.5"}>
              {q.options.map((option, i) => {
                const count = q.counts[i] ?? 0;
                const pct = q.total > 0 ? Math.round((count / q.total) * 100) : 0;
                const isCorrect = q.correct_index === i;
                const revealed = q.correct_index !== null;
                const color = isCorrect
                  ? "var(--color-emerald-400, #34d399)"
                  : VIVID_PALETTE[i % VIVID_PALETTE.length];
                return (
                  <BarRow
                    key={i}
                    label={option}
                    icon={isCorrect ? <Check className="size-4 shrink-0 text-emerald-400" /> : undefined}
                    pct={pct}
                    meta={`${pct}% · ${count}`}
                    color={color}
                    screen={screen}
                    leading={isCorrect}
                    muted={revealed && !isCorrect}
                  />
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
        <div className={screen ? "space-y-2.5" : "space-y-1.5"}>
          {statements.map((s, i) => {
            const pct = s.avg !== null ? ((s.avg - 1) / (scaleMax - 1)) * 100 : 0;
            return (
              <BarRow
                key={i}
                label={s.statement}
                pct={pct}
                meta={s.avg !== null ? s.avg.toFixed(1) : "—"}
                color="var(--brand,#38bdf8)"
                screen={screen}
                muted={s.avg === null}
              />
            );
          })}
        </div>
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
            className={`relative overflow-hidden rounded-2xl border border-[var(--brand,#38bdf8)]/40 bg-neutral-900 font-medium leading-snug ${
              screen ? "p-10 text-center text-4xl" : "p-4 pl-9 text-base"
            }`}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(120% 100% at 50% -10%, color-mix(in oklch, var(--brand,#38bdf8) 16%, transparent), transparent 70%)" }}
            />
            <Quote
              className={`relative text-[var(--brand,#38bdf8)]/50 ${screen ? "mx-auto mb-2 size-9" : "absolute left-3 top-3.5 size-4"}`}
              fill="currentColor"
            />
            <span className="relative">{spotlight.text}</span>
          </blockquote>
        )}
        <div className={`flex flex-wrap ${screen ? "justify-center gap-4" : "gap-2"}`}>
          {rest.map((e, i) => {
            const color = VIVID_PALETTE[i % VIVID_PALETTE.length];
            return (
              <span
                key={e.id}
                className={`rounded-xl border font-medium leading-snug ${screen ? "px-5 py-3 text-2xl" : "px-3 py-1.5 text-sm"}`}
                style={{
                  borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
                  background: `color-mix(in oklch, ${color} 10%, var(--color-neutral-900))`,
                }}
              >
                {e.text}
              </span>
            );
          })}
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
      <div className={screen ? "space-y-2.5" : "space-y-1.5"}>
        {items.map((item, i) => {
          // menor posição média = mais bem ranqueado = barra maior
          const strength = item.avg_pos !== null ? 1 - (item.avg_pos - 1) / Math.max(1, n - 1) : 0;
          return (
            <BarRow
              key={item.index}
              label={
                <>
                  <span className="mr-2 font-mono text-neutral-500">{i + 1}.</span>
                  {item.option}
                </>
              }
              pct={Math.round(20 + strength * 80)}
              meta={item.avg_pos !== null ? `média ${item.avg_pos.toFixed(1)}` : "—"}
              color={VIVID_PALETTE[i % VIVID_PALETTE.length]}
              screen={screen}
              leading={i === 0}
            />
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
          {items.map((item, i) => {
            const color = VIVID_PALETTE[i % VIVID_PALETTE.length];
            return (
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
                      background: color,
                      boxShadow: `0 0 0 4px color-mix(in oklch, ${color} 25%, transparent), 0 0 14px -2px ${color}`,
                    }}
                  />
                  <span
                    className={`mt-1 max-w-32 truncate rounded-full text-center font-medium ${
                      screen ? "px-3 py-1 text-xl" : "px-2 py-0.5 text-[11px]"
                    }`}
                    style={{ background: `color-mix(in oklch, ${color} 16%, var(--color-neutral-900))` }}
                  >
                    {item.option}
                  </span>
                </div>
              </div>
            );
          })}
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
    <div className={screen ? "space-y-2.5" : "space-y-1.5"}>
      {options.map((option, i) => {
        const count = counts[i] ?? 0;
        const pct = results.total > 0 ? Math.round((count / results.total) * 100) : 0;
        const isLeading = count > 0 && count === leadCount;
        return (
          <BarRow
            key={i}
            label={option}
            pct={pct}
            meta={`${pct}% · ${count}`}
            color={VIVID_PALETTE[i % VIVID_PALETTE.length]}
            screen={screen}
            leading={isLeading}
          />
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

  // No telão, o pódio vira um pódio de verdade — colunas de altura
  // diferente, não só uma lista com medalha na frente.
  if (podium && screen) {
    const top3 = rows.slice(0, 3);
    const rest = rows.slice(3);
    const order = [1, 0, 2].filter((idx) => idx < top3.length);
    const standHeight = ["h-32", "h-44", "h-24"];
    const standTint = ["var(--color-amber-400)", "var(--color-neutral-300)", "var(--color-orange-400)"];
    return (
      <div>
        <div className="flex items-end justify-center gap-4">
          {order.map((idx) => {
            const row = top3[idx];
            return (
              <div key={idx} className="flex w-44 flex-col items-center">
                <span className="mb-1 text-5xl">{MEDALS[idx]}</span>
                <span className={`mb-1 max-w-full truncate text-xl font-bold ${MEDAL_COLORS[idx]}`}>
                  {row.name || "Participante"}
                </span>
                <span className="mb-2 font-mono text-lg tabular-nums text-neutral-400">{row.score} pts</span>
                <div
                  className={`flex w-full items-start justify-center rounded-t-xl pt-2 ${standHeight[idx]}`}
                  style={{ background: `color-mix(in oklch, ${standTint[idx]} 18%, var(--color-neutral-900))` }}
                >
                  <span className="text-3xl font-black text-neutral-500">{idx + 1}º</span>
                </div>
              </div>
            );
          })}
        </div>
        {rest.length > 0 && (
          <ol className="mx-auto mt-8 max-w-xl space-y-2">
            {rest.map((row, i) => (
              <li key={`${row.name}-${i}`} className="flex items-center justify-between gap-4 text-xl text-neutral-300">
                <span className="min-w-0 truncate">
                  <span className="mr-2 inline-block w-10 text-right font-mono text-neutral-500">{i + 4}.</span>
                  {row.name || "Participante"}
                </span>
                <span className="shrink-0 font-mono tabular-nums">
                  {row.score}
                  <span className="ml-2 text-neutral-500">
                    {row.correct} acerto{row.correct === 1 ? "" : "s"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
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
