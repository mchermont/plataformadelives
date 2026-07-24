"use client";

import { useEffect, useState, type RefObject } from "react";

export interface FitResult {
  cols: number;
  itemWidth: number;
  itemHeight: number;
}

const EMPTY: FitResult = { cols: 1, itemWidth: 0, itemHeight: 0 };

/**
 * Encaixa N tiles de proporção fixa (16:9 por padrão) dentro do espaço
 * medido do contêiner, sem nunca precisar de scroll: testa cada número de
 * colunas possível e escolhe o que maximiza o tamanho do tile respeitando
 * largura E altura disponíveis ao mesmo tempo (mesmo algoritmo do "gallery
 * view" do Zoom/Meet) — cresce o número de colunas conforme mais gente
 * entra em vez de espremer a altura de cada tile.
 *
 * `forceCols: 1` vira uma coluna única que só encolhe em altura (rail
 * vertical de miniaturas). `forceCols: count` vira uma linha única que só
 * encolhe em largura (fileira horizontal de miniaturas). `minCols` impede
 * o algoritmo de "maximizar tile" escolher menos colunas que isso, mesmo
 * quando tecnicamente daria tiles um pouco maiores — usado quando o
 * produto quer uma regra fixa de quebra (ex.: sempre virar 2 colunas a
 * partir de 5 participantes).
 */
export function useFitTiles(
  containerRef: RefObject<HTMLElement | null>,
  count: number,
  opts?: { gap?: number; aspect?: number; forceCols?: number; minCols?: number }
): FitResult {
  const gap = opts?.gap ?? 8;
  const aspect = opts?.aspect ?? 16 / 9;
  const forceCols = opts?.forceCols;
  const minCols = opts?.minCols ?? 1;
  const [result, setResult] = useState<FitResult>(EMPTY);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || count <= 0) {
      setResult(EMPTY);
      return;
    }

    const compute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;

      const candidates = forceCols
        ? [Math.max(1, Math.min(forceCols, count))]
        : Array.from({ length: count - Math.min(minCols, count) + 1 }, (_, i) => Math.min(minCols, count) + i);

      let best: FitResult = EMPTY;
      for (const cols of candidates) {
        const rows = Math.ceil(count / cols);
        const widthByCols = (w - gap * (cols - 1)) / cols;
        const heightByRows = (h - gap * (rows - 1)) / rows;
        const itemWidth = Math.min(widthByCols, heightByRows * aspect);
        if (itemWidth > best.itemWidth) {
          best = { cols, itemWidth, itemHeight: itemWidth / aspect };
        }
      }
      setResult(best);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, count, gap, aspect, forceCols, minCols]);

  return result;
}
