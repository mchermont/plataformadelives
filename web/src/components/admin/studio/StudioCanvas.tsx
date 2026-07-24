"use client";

import { useParticipants } from "@livekit/components-react";
import { StudioAsset, StudioLayout, StudioRoom } from "@/lib/types";
import { User } from "lucide-react";
import { StudioParticipantTile } from "./StudioParticipantTile";
import { useFitTiles } from "./useFitTiles";
import { StudioTileGrid } from "./StudioTileGrid";

interface StudioCanvasProps {
  roomState: StudioRoom;
  assets: StudioAsset[];
  onParticipantClick?: (participantId: string) => void;
  /** false na saída limpa pro OBS — sem chrome de UI (selo de destaque etc.) */
  showSpotlightBadge?: boolean;
  /** Overlay "AO VIVO" no canto superior esquerdo — só pra quem está no Estúdio, nunca no output */
  showLiveBadge?: boolean;
  /**
   * Estado otimista local de quem foi movido pro palco/backstage — o
   * Diretor vê o efeito na hora, sem esperar o round-trip até o LiveKit
   * (que pode levar segundos) confirmar o atributo de verdade.
   */
  stageOverrides?: Record<string, boolean>;
}

// Salas antigas podem ter gravado os nomes de cena de antes da unificação
// pessoa/mídia (migração conceitual, sem migração de banco — active_layout
// é VARCHAR livre). Normaliza pro arranjo equivalente mais próximo.
const LEGACY_LAYOUT_MAP: Record<string, StudioLayout> = {
  spotlight: "thumbs-bottom",
  presentation: "thumbs-right",
};

export function StudioCanvas({
  roomState,
  assets,
  onParticipantClick,
  showSpotlightBadge = true,
  showLiveBadge = false,
  stageOverrides,
}: StudioCanvasProps) {
  const participants = useParticipants();

  // Filtra participantes que estão no PALCO (sem memo — precisa recalcular
  // em toda renderização causada por useParticipants(), nunca ficar preso
  // a uma referência antiga).
  const stageParticipants = participants.filter((p) => {
    const override = stageOverrides?.[p.identity];
    if (override !== undefined) return override;
    const isDirector = p.identity.startsWith("diretor-");
    // Diretor: fica no palco por padrão (a menos que explicitamente movido para backstage)
    if (isDirector) {
      return p.attributes?.isOnStage !== "false";
    }
    // Convidado: fica no backstage por padrão (precisa ser explicitamente colocado no palco)
    return p.attributes?.isOnStage === "true";
  });

  const activeBanner = roomState.active_banner_id
    ? assets.find((a) => a.id === roomState.active_banner_id)
    : null;

  const activePresentation = roomState.active_presentation_id
    ? assets.find((a) => a.id === roomState.active_presentation_id)
    : null;

  const activeSlideUrl = activePresentation
    ? ((activePresentation.content_json?.slides as string[]) || [])[roomState.active_slide_index || 0] || null
    : null;

  const isMediaActive = Boolean(activeSlideUrl);
  const layout: StudioLayout = LEGACY_LAYOUT_MAP[roomState.active_layout] || roomState.active_layout;

  // Conteúdo primário (o "destaque"): mídia tem prioridade; senão, a pessoa
  // marcada pelo Diretor como Apresentador (ou a primeira do palco).
  const primaryPerson =
    stageParticipants.length === 0
      ? null
      : stageParticipants.find((p) => p.identity === roomState.spotlight_participant_id) ||
        stageParticipants[0];

  // Resto do palco — usado pelos arranjos com miniaturas.
  const restParticipants = primaryPerson
    ? stageParticipants.filter((p) => p.identity !== primaryPerson.identity)
    : stageParticipants;

  // Secundários dos arranjos "thumbs-*": todo mundo do palco quando a mídia
  // é o destaque (inclusive o Apresentador, que vira miniatura); senão, o
  // resto do palco sem quem já é o destaque.
  const secondaries = isMediaActive ? stageParticipants : restParticipants;

  const renderTile = (p: (typeof participants)[0], isThumbnail = false, tightCrop = false) => (
    <StudioParticipantTile
      key={p.sid}
      participant={p}
      variant={isThumbnail ? "thumbnail" : "full"}
      isSpotlighted={p.identity === roomState.spotlight_participant_id}
      showSpotlightBadge={showSpotlightBadge}
      selectable={Boolean(onParticipantClick)}
      onSelect={onParticipantClick}
      tightCrop={tightCrop}
    />
  );

  const renderMedia = () => (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={activeSlideUrl!} alt="Slide ativo" className="h-full w-full object-contain" />
    </div>
  );

  // Hooks de encaixe (sempre chamados, incondicionalmente — só o `ref` do
  // arranjo ativo de fato é anexado a um elemento montado no DOM).
  const gridCellCount = (isMediaActive ? 1 : 0) + stageParticipants.length;
  const gridFit = useFitTiles(gridCellCount, { gap: 12 });
  const bottomRowFit = useFitTiles(secondaries.length, {
    gap: 8,
    forceCols: secondaries.length || 1,
  });

  const stageEmpty = !isMediaActive && stageParticipants.length === 0;

  // Intérprete de Libras — overlay PIP fixo, independente do arranjo ativo
  // (nunca faz parte do palco/grade normal).
  const activeInterpreter = roomState.active_interpreter_id
    ? participants.find((p) => p.identity === roomState.active_interpreter_id)
    : null;

  const renderStage = () => {
    if (stageEmpty) {
      return (
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="h-16 w-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 shadow-lg">
            <User className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium text-neutral-400 max-w-sm">
            O palco está vazio. Adicione participantes do backstage abaixo para ir ao ar.
          </p>
        </div>
      );
    }

    switch (layout) {
      case "grid": {
        const cells: Array<{ key: string; node: React.ReactNode }> = [];
        if (isMediaActive) cells.push({ key: "media", node: renderMedia() });
        stageParticipants.forEach((p) => cells.push({ key: p.sid, node: renderTile(p, false) }));
        return (
          <div className="relative z-10 h-full w-full p-4">
            <div ref={gridFit.ref} className="h-full w-full">
              {gridFit.itemWidth > 0 && (
                <div
                  className="grid h-full content-center justify-center gap-3"
                  style={{ gridTemplateColumns: `repeat(${gridFit.cols}, ${gridFit.itemWidth}px)` }}
                >
                  {cells.map((c) => (
                    <div key={c.key} style={{ width: gridFit.itemWidth, height: gridFit.itemHeight }}>
                      {c.node}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "solo": {
        const content = isMediaActive ? renderMedia() : primaryPerson ? renderTile(primaryPerson) : null;
        return <div className="relative z-10 h-full w-full p-4">{content}</div>;
      }

      case "split": {
        // Lado a lado de verdade, sempre — não depende do viewport do
        // navegador (o `md:` reage ao tamanho da JANELA, não do canvas,
        // que pode estar estreito mesmo numa tela grande por causa das
        // sidebars, deixando "lado a lado" empilhado por engano).
        if (!isMediaActive) {
          // Sem mídia: comportamento original — grade forçada em 2 colunas com todo o palco.
          return (
            <div className="relative z-10 grid h-full w-full grid-cols-2 gap-3 p-4">
              {stageParticipants.map((p) => renderTile(p, false))}
            </div>
          );
        }
        return (
          <div className="relative z-10 grid h-full w-full grid-cols-2 gap-3 p-4">
            <div>{primaryPerson ? renderTile(primaryPerson) : null}</div>
            <div>{renderMedia()}</div>
          </div>
        );
      }

      case "split-2-1": {
        const primaryContent = isMediaActive
          ? renderMedia()
          : primaryPerson
            ? renderTile(primaryPerson)
            : null;
        const explicitSecondary = roomState.secondary_participant_id
          ? restParticipants.find((p) => p.identity === roomState.secondary_participant_id)
          : null;
        const secondaryPerson = isMediaActive ? primaryPerson : explicitSecondary || restParticipants[0] || null;
        return (
          <div className="relative z-10 flex h-full w-full gap-3 p-4">
            <div className="min-w-0 flex-[2]">{primaryContent}</div>
            {secondaryPerson && <div className="min-w-0 flex-1">{renderTile(secondaryPerson, true)}</div>}
          </div>
        );
      }

      case "thumbs-right":
      case "thumbs-left": {
        const primaryContent = isMediaActive
          ? renderMedia()
          : primaryPerson
            ? renderTile(primaryPerson)
            : null;

        const thumbsColumn = secondaries.length > 0 && (
          <div className={`h-full flex-shrink-0 ${secondaries.length > 5 ? "w-72" : "w-56"}`}>
            <StudioTileGrid
              items={secondaries}
              getKey={(p) => p.sid}
              renderItem={(p, { cols }) => renderTile(p, true, cols === 2)}
            />
          </div>
        );

        return (
          <div className="relative z-10 flex h-full w-full gap-3 p-4">
            {layout === "thumbs-left" && thumbsColumn}
            <div className="relative min-w-0 flex-1">{primaryContent}</div>
            {layout === "thumbs-right" && thumbsColumn}
          </div>
        );
      }

      case "thumbs-bottom": {
        const primaryContent = isMediaActive
          ? renderMedia()
          : primaryPerson
            ? renderTile(primaryPerson)
            : null;
        return (
          <div className="relative z-10 flex h-full w-full flex-col gap-3 p-4">
            <div className="min-h-0 flex-1">{primaryContent}</div>
            {secondaries.length > 0 && (
              <div ref={bottomRowFit.ref} className="h-32 w-full flex-shrink-0">
                {bottomRowFit.itemWidth > 0 && (
                  <div className="flex h-full w-full items-center justify-center gap-2">
                    {secondaries.map((p) => (
                      <div
                        key={p.sid}
                        style={{ width: bottomRowFit.itemWidth, height: bottomRowFit.itemHeight }}
                      >
                        {renderTile(p, true)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case "pip": {
        const primaryContent = isMediaActive
          ? renderMedia()
          : primaryPerson
            ? renderTile(primaryPerson)
            : null;
        const pipPerson = isMediaActive ? primaryPerson : restParticipants[0] || null;
        return (
          <div className="relative z-10 h-full w-full p-4">
            <div className="h-full w-full">{primaryContent}</div>
            {pipPerson && (
              <div
                className="absolute shadow-2xl"
                style={{ height: "26%", aspectRatio: "16 / 9", bottom: "6%", right: "6%" }}
              >
                {renderTile(pipPerson, true)}
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 h-full w-full bg-neutral-950 flex items-center justify-center">
      {/* 1. Imagem de Fundo (Fundo de Tela) */}
      {roomState.active_background_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomState.active_background_url}
          alt="Fundo"
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      )}

      {/* 2. Palco: participantes e/ou mídia, de acordo com o arranjo ativo */}
      {renderStage()}

      {/* 2.5 Selo "AO VIVO" — só pra quem está no Estúdio (Diretor/convidado), nunca no output */}
      {showLiveBadge && (
        <div className="pointer-events-none absolute left-4 top-4 z-40">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-800/80 bg-emerald-950/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400 backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> AO VIVO
          </span>
        </div>
      )}

      {/* 2.7 Intérprete de Libras — PIP fixo, sempre por cima, em 4:3.
          Tamanho/posição em % do player (não px fixo): o player renderiza
          em tamanhos de tela bem diferentes pro Diretor/convidado/output,
          então px fixo faz o PIP parecer proporcionalmente maior ou menor
          dependendo de quem está vendo — em % ele fica idêntico pra todo
          mundo, exatamente como o Diretor está vendo. */}
      {activeInterpreter && (
        <div
          className="absolute z-40"
          style={{
            height: "22%",
            aspectRatio: "4 / 3",
            bottom: "4%",
            [roomState.interpreter_position === "bottom-left" ? "left" : "right"]: "4%",
          }}
        >
          <StudioParticipantTile participant={activeInterpreter} variant="thumbnail" showName />
        </div>
      )}

      {/* 3. Logo da Marca (Upper Right) */}
      {roomState.active_logo_url && (
        <div className="absolute top-6 right-6 z-20 pointer-events-none max-w-[140px] max-h-[60px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roomState.active_logo_url}
            alt="Logo"
            className="h-full w-full object-contain drop-shadow-md"
          />
        </div>
      )}

      {/* 4. Overlay Moldura Transparente */}
      {roomState.active_overlay_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomState.active_overlay_url}
          alt="Overlay"
          className="absolute inset-0 z-30 h-full w-full object-cover pointer-events-none"
        />
      )}

      {/* 5. GC / Banner de Texto em Destaque */}
      {activeBanner && (
        <div className="absolute bottom-6 left-6 z-40 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-xl bg-emerald-500 p-4 text-neutral-950 shadow-2xl border border-emerald-400">
            <h3 className="text-base font-extrabold leading-tight tracking-tight">
              {activeBanner.title}
            </h3>
            {activeBanner.subtitle && (
              <p className="mt-1 text-xs font-medium text-neutral-900 opacity-90">
                {activeBanner.subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
