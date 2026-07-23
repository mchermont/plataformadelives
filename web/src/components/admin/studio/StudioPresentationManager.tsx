"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
import { StudioAsset, StudioRoom } from "@/lib/types";

interface StudioPresentationManagerProps {
  roomState: StudioRoom;
  assets: StudioAsset[];
  onUpdateRoom: (updates: Partial<StudioRoom>) => void;
  onCreateAsset: (asset: Partial<StudioAsset>) => void;
}

export function StudioPresentationManager({
  roomState,
  assets,
  onUpdateRoom,
  onCreateAsset,
}: StudioPresentationManagerProps) {
  const [title, setTitle] = useState("");
  const [urlsInput, setUrlsInput] = useState("");

  const presentations = assets.filter((a) => a.asset_type === "presentation");
  const activePresentation = presentations.find((p) => p.id === roomState.active_presentation_id);

  const slides: string[] = activePresentation?.content_json?.slides as string[] || [];
  const currentSlideIndex = roomState.active_slide_index || 0;

  const handleCreatePresentation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !urlsInput.trim()) return;

    const slidesList = urlsInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.startsWith("http"));

    if (slidesList.length === 0) {
      alert("Insira pelo menos uma URL de imagem válida de slide.");
      return;
    }

    onCreateAsset({
      asset_type: "presentation",
      title: title.trim(),
      content_json: { slides: slidesList },
    });

    setTitle("");
    setUrlsInput("");
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      onUpdateRoom({ active_slide_index: currentSlideIndex - 1 });
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      onUpdateRoom({ active_slide_index: currentSlideIndex + 1 });
    }
  };

  return (
    <div className="space-y-4">
      {/* Controles do Slide Ativo no Palco */}
      {activePresentation ? (
        <div className="rounded-xl border border-emerald-500 bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Apresentação em Exibição
            </span>
            <button
              onClick={() => onUpdateRoom({ active_presentation_id: null, active_layout: "grid" })}
              className="text-xs font-semibold text-rose-400 hover:underline"
            >
              Remover do Palco
            </button>
          </div>

          <p className="text-xs font-bold text-neutral-100 truncate">{activePresentation.title}</p>

          {/* Miniatura do Slide Ativo + Navegação */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center">
            {slides[currentSlideIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slides[currentSlideIndex]}
                alt={`Slide ${currentSlideIndex + 1}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-neutral-500">Sem slide</span>
            )}
          </div>

          {/* Botões de Navegação Anterior / Próximo */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handlePrevSlide}
              disabled={currentSlideIndex === 0}
              className="flex items-center gap-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>

            <span className="text-xs font-mono text-neutral-400">
              {currentSlideIndex + 1} / {slides.length}
            </span>

            <button
              onClick={handleNextSlide}
              disabled={currentSlideIndex >= slides.length - 1}
              className="flex items-center gap-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-40"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Formulário de Nova Apresentação */}
      <form onSubmit={handleCreatePresentation} className="space-y-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
        <span className="text-xs font-semibold text-neutral-300 block">Nova Apresentação de Slides</span>
        <input
          type="text"
          placeholder="Título da Apresentação (ex: Decks de Vendas)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
        />
        <textarea
          placeholder="Cole as URLs das imagens dos slides (uma por linha)"
          value={urlsInput}
          onChange={(e) => setUrlsInput(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none font-mono"
        />
        <button
          type="submit"
          disabled={!title.trim() || !urlsInput.trim()}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Adicionar Apresentação
        </button>
      </form>

      {/* Lista de Apresentações Salvas */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
          Apresentações Salvas
        </span>
        {presentations.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">Nenhuma apresentação adicionada ainda.</p>
        ) : (
          presentations.map((p) => {
            const isActive = roomState.active_presentation_id === p.id;
            const slideCount = (p.content_json?.slides as string[])?.length || 0;

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition ${
                  isActive
                    ? "border-emerald-500 bg-emerald-950/20"
                    : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-medium text-neutral-100 truncate">{p.title}</p>
                  <p className="text-[11px] text-neutral-400">{slideCount} slide(s)</p>
                </div>
                <button
                  onClick={() =>
                    onUpdateRoom({
                      active_presentation_id: isActive ? null : p.id,
                      active_layout: isActive ? "grid" : "presentation",
                      active_slide_index: 0,
                    })
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {isActive ? "Remover" : "Exibir no Palco"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
