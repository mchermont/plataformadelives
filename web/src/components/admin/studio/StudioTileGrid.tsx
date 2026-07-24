"use client";

import type { ReactNode } from "react";
import { useFitTiles } from "./useFitTiles";

interface StudioTileGridProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, ctx: { cols: number }) => ReactNode;
  gap?: number;
  className?: string;
  /** "center" (padrão) — cresce a partir do meio, pro rail de destaque do player.
   *  "start" — ancora no topo, pra listas de gerenciamento como o backstage. */
  align?: "center" | "start";
}

/**
 * Até 5 itens fica numa coluna só, empilhados; a partir do 6º quebra em 2
 * colunas (nunca mais que isso) — e quando sobra 1 item sozinho na última
 * fileira, ele fica centralizado embaixo em vez de grudado à esquerda
 * (limitação do CSS Grid puro: uma fileira incompleta não centraliza
 * sozinha). Ao entrar o próximo, o órfão volta a formar par normalmente.
 */
function colsFor(count: number) {
  return count <= 5 ? 1 : 2;
}

export function StudioTileGrid<T>({
  items,
  getKey,
  renderItem,
  gap = 8,
  className = "",
  align = "center",
}: StudioTileGridProps<T>) {
  const cols = colsFor(items.length);
  const fit = useFitTiles(items.length, { gap, forceCols: cols });

  const fullRowsCount = Math.floor(items.length / cols) * cols;
  const mainItems = items.slice(0, fullRowsCount);
  const orphan = items.slice(fullRowsCount);
  const justify = align === "start" ? "justify-start" : "justify-center";

  return (
    <div className={`flex h-full w-full flex-col items-center ${justify} gap-2 ${className}`} ref={fit.ref}>
      {fit.itemWidth > 0 && (
        <>
          <div
            className="grid content-center justify-center gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, ${fit.itemWidth}px)` }}
          >
            {mainItems.map((item) => (
              <div key={getKey(item)} style={{ width: fit.itemWidth, height: fit.itemHeight }}>
                {renderItem(item, { cols })}
              </div>
            ))}
          </div>
          {orphan.map((item) => (
            <div key={getKey(item)} style={{ width: fit.itemWidth, height: fit.itemHeight }}>
              {renderItem(item, { cols })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
