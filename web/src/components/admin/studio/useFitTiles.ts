"use client";

import { useCallback, useEffect, useState } from "react";

export interface FitResult {
  cols: number;
  itemWidth: number;
  itemHeight: number;
  /** Anexar num elemento — vira o contêiner medido. */
  ref: (el: HTMLElement | null) => void;
}

const EMPTY_SIZE = { cols: 1, itemWidth: 0, itemHeight: 0 };

/**
 * Encaixa N tiles de proporção fixa (16:9 por padrão) dentro do espaço
 * medido do contêiner, sem nunca precisar de scroll: testa cada número de
 * colunas possível e escolhe o que maximiza o tamanho do tile respeitando
 * largura E altura disponíveis ao mesmo tempo (mesmo algoritmo do "gallery
 * view" do Zoom/Meet) — cresce o número de colunas conforme mais gente
 * entra em vez de espremer a altura de cada tile.
 *
 * Usa um callback ref (em vez de `useRef` externo) de propósito: quando o
 * Diretor troca de cena, a div medida de uma cena desmonta e a de outra
 * monta — se o contêiner fosse um `useRef` comum, o efeito só recalcula
 * quando `count`/`gap`/etc mudam, e SE `count` continuar igual (mesma
 * galera no palco, só trocou o arranjo) o efeito nunca dispara de novo, e
 * o novo contêiner fica medido como vazio até algo mais mudar `count`
 * (ex.: subir/descer alguém do palco) — exatamente o bug de "só aparece
 * depois que mexo em alguém". Com callback ref, o REACT NODE em si vira
 * dependência de estado, então o remount dispara o recálculo sozinho.
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
  count: number,
  opts?: { gap?: number; aspect?: number; forceCols?: number; minCols?: number }
): FitResult {
  const gap = opts?.gap ?? 8;
  const aspect = opts?.aspect ?? 16 / 9;
  const forceCols = opts?.forceCols;
  const minCols = opts?.minCols ?? 1;

  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);
  const [size, setSize] = useState(EMPTY_SIZE);

  useEffect(() => {
    if (!node || count <= 0) {
      setSize(EMPTY_SIZE);
      return;
    }

    const compute = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w <= 0 || h <= 0) return;

      const candidates = forceCols
        ? [Math.max(1, Math.min(forceCols, count))]
        : Array.from({ length: count - Math.min(minCols, count) + 1 }, (_, i) => Math.min(minCols, count) + i);

      let best = EMPTY_SIZE;
      for (const cols of candidates) {
        const rows = Math.ceil(count / cols);
        const widthByCols = (w - gap * (cols - 1)) / cols;
        const heightByRows = (h - gap * (rows - 1)) / rows;
        const itemWidth = Math.min(widthByCols, heightByRows * aspect);
        if (itemWidth > best.itemWidth) {
          best = { cols, itemWidth, itemHeight: itemWidth / aspect };
        }
      }
      setSize(best);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, count, gap, aspect, forceCols, minCols]);

  return { ...size, ref };
}

export interface FitWidthResult {
  itemWidth: number;
  itemHeight: number;
  ref: (el: HTMLElement | null) => void;
}

/**
 * Encaixa tiles de proporção fixa só pela LARGURA do contêiner — a altura
 * de cada tile (e portanto a altura total do bloco) sai da proporção, não
 * é medida. Diferente de `useFitTiles`, que mede altura E largura pra
 * maximizar o tile dentro de um contêiner com altura FIXA (bom pra área
 * do player, que é sempre 16:9) — aqui o bloco inteiro cresce ou encolhe
 * verticalmente conforme o número de linhas, então o que vier depois dele
 * (ex.: a seção de intérpretes, embaixo da lista de participantes) sobe
 * ou desce junto, em vez de ficar preso no fundo de uma área esticada.
 */
export function useFitWidth(cols: number, opts?: { gap?: number; aspect?: number }): FitWidthResult {
  const gap = opts?.gap ?? 8;
  const aspect = opts?.aspect ?? 16 / 9;

  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!node) {
      setWidth(0);
      return;
    }
    const compute = () => setWidth(node.clientWidth);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  const itemWidth = cols > 0 && width > 0 ? Math.max(0, (width - gap * (cols - 1)) / cols) : 0;
  return { itemWidth, itemHeight: itemWidth / aspect, ref };
}
