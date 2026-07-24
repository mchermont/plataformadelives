"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Plus, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  const [slides, setSlides] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const presentations = assets.filter((a) => a.asset_type === "presentation");
  const activePresentation = presentations.find((p) => p.id === roomState.active_presentation_id);

  const activeSlides: string[] = (activePresentation?.content_json?.slides as string[]) || [];
  const currentSlideIndex = roomState.active_slide_index || 0;

  // Converte cada página do PDF numa imagem PNG e sobe pro Storage —
  // conversão acontece inteira no navegador (pdfjs-dist), sem servidor
  // extra nem custo por arquivo.
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConverting(true);
    setProgress(null);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const supabase = createClient();
      const uploadedUrls: string[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        setProgress({ current: i, total: doc.numPages });

        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        if (!context) continue;

        await page.render({ canvasContext: context, viewport, canvas }).promise;

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png")
        );
        if (!blob) continue;

        const path = `slides/slide-${crypto.randomUUID()}.png`;
        const { error } = await supabase.storage.from("materials").upload(path, blob);
        if (!error) {
          const { data } = supabase.storage.from("materials").getPublicUrl(path);
          if (data.publicUrl) uploadedUrls.push(data.publicUrl);
        } else {
          console.error("Erro no upload da página convertida:", error);
        }
      }

      if (uploadedUrls.length === 0) {
        alert("Não foi possível converter nenhuma página do PDF. Tente novamente.");
        return;
      }

      setSlides(uploadedUrls);
      if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, ""));
    } catch (err) {
      console.error("Erro ao converter PDF:", err);
      alert("Falha ao converter o PDF. Verifique se o arquivo não está corrompido.");
    } finally {
      setConverting(false);
      setProgress(null);
      e.target.value = "";
    }
  };

  const handleCreatePresentation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || slides.length === 0) return;

    onCreateAsset({
      asset_type: "presentation",
      title: title.trim(),
      content_json: { slides },
    });

    setTitle("");
    setSlides([]);
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      onUpdateRoom({ active_slide_index: currentSlideIndex - 1 });
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < activeSlides.length - 1) {
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
              onClick={() => onUpdateRoom({ active_presentation_id: null })}
              className="text-xs font-semibold text-rose-400 hover:underline"
            >
              Remover do Palco
            </button>
          </div>

          <p className="text-xs font-bold text-neutral-100 truncate">{activePresentation.title}</p>

          {/* Miniatura do Slide Ativo + Navegação */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center">
            {activeSlides[currentSlideIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeSlides[currentSlideIndex]}
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
              {currentSlideIndex + 1} / {activeSlides.length}
            </span>

            <button
              onClick={handleNextSlide}
              disabled={currentSlideIndex >= activeSlides.length - 1}
              className="flex items-center gap-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-40"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Formulário de Nova Apresentação com Upload de PDF */}
      <form onSubmit={handleCreatePresentation} className="space-y-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
        <span className="text-xs font-semibold text-neutral-300 block">Nova Apresentação (PDF)</span>
        <p className="text-[11px] text-neutral-500">
          Exporte sua apresentação como PDF (PowerPoint, Keynote e Google
          Slides fazem isso em 1 clique) e envie aqui — cada página vira um
          slide navegável.
        </p>

        {/* Botão de Upload do PDF */}
        <label className="flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-neutral-700 bg-neutral-900 py-2.5 px-3 text-xs font-semibold text-neutral-300 hover:border-emerald-500 hover:text-emerald-400 transition">
          {converting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              {progress ? `Convertendo página ${progress.current} de ${progress.total}…` : "Lendo PDF…"}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Escolher arquivo PDF no computador
            </>
          )}
          <input
            type="file"
            accept="application/pdf"
            disabled={converting}
            onChange={handlePdfUpload}
            className="hidden"
          />
        </label>

        {slides.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <FileText className="h-3.5 w-3.5" /> {slides.length} página(s) convertida(s)
          </div>
        )}

        <input
          type="text"
          placeholder="Título da Apresentação (ex: Decks de Vendas)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!title.trim() || slides.length === 0 || converting}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Salvar Apresentação
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
