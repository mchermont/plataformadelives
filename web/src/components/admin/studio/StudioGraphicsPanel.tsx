"use client";

import { useState } from "react";
import { Image, Layers, Sparkles, Type, Plus, Check, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StudioAsset, StudioRoom } from "@/lib/types";
import { StudioPresentationManager } from "./StudioPresentationManager";

interface StudioGraphicsPanelProps {
  roomState: StudioRoom;
  assets: StudioAsset[];
  onUpdateRoom: (updates: Partial<StudioRoom>) => void;
  onCreateAsset: (asset: Partial<StudioAsset>) => void;
}

export function StudioGraphicsPanel({
  roomState,
  assets,
  onUpdateRoom,
  onCreateAsset,
}: StudioGraphicsPanelProps) {
  const [activeTab, setActiveTab] = useState<"graphics" | "captions" | "presentation">("graphics");
  const [newGcText, setNewGcText] = useState("");
  const [newGcSubtext, setNewGcSubtext] = useState("");
  const [uploadingKind, setUploadingKind] = useState<"logo" | "overlay" | "background" | null>(null);

  const logos = assets.filter((a) => a.asset_type === "logo");
  const overlays = assets.filter((a) => a.asset_type === "overlay");
  const backgrounds = assets.filter((a) => a.asset_type === "background");
  const gcs = assets.filter((a) => a.asset_type === "gc_name" || a.asset_type === "banner");

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: "logo" | "overlay" | "background"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKind(assetType);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `studio/${assetType}-${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from("branding").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("branding").getPublicUrl(path);
        if (data.publicUrl) {
          onCreateAsset({
            asset_type: assetType,
            title: file.name,
            file_url: data.publicUrl,
          });
        }
      } else {
        console.error("Erro no upload da imagem:", error);
        alert("Falha no upload da imagem.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingKind(null);
    }
  };

  const handleCreateGc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGcText.trim()) return;

    onCreateAsset({
      asset_type: "banner",
      title: newGcText.trim(),
      subtitle: newGcSubtext.trim() || null,
    });

    setNewGcText("");
    setNewGcSubtext("");
  };

  return (
    <div className="flex h-full flex-col bg-neutral-900 border-l border-neutral-800 text-neutral-200">
      {/* Abas Superiores do Painel */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab("graphics")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 ${
            activeTab === "graphics"
              ? "border-emerald-500 text-emerald-400 bg-neutral-800/50"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Gráficos
        </button>
        <button
          onClick={() => setActiveTab("captions")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 ${
            activeTab === "captions"
              ? "border-emerald-500 text-emerald-400 bg-neutral-800/50"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Type className="h-3.5 w-3.5" />
          GCs
        </button>
        <button
          onClick={() => setActiveTab("presentation")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 ${
            activeTab === "presentation"
              ? "border-emerald-500 text-emerald-400 bg-neutral-800/50"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Slides
        </button>
      </div>

      {/* Conteúdo da Aba */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === "graphics" && (
          <>
            {/* Seção Logo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5" /> Marca / Logo
                </span>

                {/* Upload de Logo */}
                <label className="cursor-pointer text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1">
                  {uploadingKind === "logo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Subir Logo
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingKind === "logo"}
                    onChange={(e) => handleUploadImage(e, "logo")}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onUpdateRoom({ active_logo_url: null })}
                  className={`relative aspect-square flex flex-col items-center justify-center rounded-lg border text-[11px] transition ${
                    !roomState.active_logo_url
                      ? "border-emerald-500 bg-emerald-950/20 text-emerald-400 font-semibold"
                      : "border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-700"
                  }`}
                >
                  Sem logo
                  {!roomState.active_logo_url && (
                    <Check className="absolute top-1 right-1 h-3 w-3 text-emerald-400" />
                  )}
                </button>
                {logos.map((logo) => (
                  <button
                    key={logo.id}
                    onClick={() => onUpdateRoom({ active_logo_url: logo.file_url })}
                    className={`relative aspect-square p-2 rounded-lg border flex items-center justify-center bg-neutral-950 transition ${
                      roomState.active_logo_url === logo.file_url
                        ? "border-emerald-500 ring-1 ring-emerald-500"
                        : "border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.file_url!} alt={logo.title} className="max-h-full max-w-full object-contain" />
                    {roomState.active_logo_url === logo.file_url && (
                      <Check className="absolute top-1 right-1 h-3.5 w-3.5 text-emerald-400 bg-neutral-900 rounded-full p-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Seção Overlays */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Molduras / Overlays
                </span>

                {/* Upload de Overlay */}
                <label className="cursor-pointer text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1">
                  {uploadingKind === "overlay" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Subir Overlay
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingKind === "overlay"}
                    onChange={(e) => handleUploadImage(e, "overlay")}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateRoom({ active_overlay_url: null })}
                  className={`h-16 flex items-center justify-center rounded-lg border text-xs transition ${
                    !roomState.active_overlay_url
                      ? "border-emerald-500 bg-emerald-950/20 text-emerald-400 font-semibold"
                      : "border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-700"
                  }`}
                >
                  Nenhum overlay
                </button>
                {overlays.map((ov) => (
                  <button
                    key={ov.id}
                    onClick={() => onUpdateRoom({ active_overlay_url: ov.file_url })}
                    className={`relative h-16 rounded-lg border overflow-hidden bg-neutral-950 transition ${
                      roomState.active_overlay_url === ov.file_url
                        ? "border-emerald-500 ring-1 ring-emerald-500"
                        : "border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ov.file_url!} alt={ov.title} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Seção Fundo de Tela */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Fundo de Tela
                </span>

                {/* Upload de Fundo */}
                <label className="cursor-pointer text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1">
                  {uploadingKind === "background" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Subir Fundo
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingKind === "background"}
                    onChange={(e) => handleUploadImage(e, "background")}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateRoom({ active_background_url: null })}
                  className={`h-14 flex items-center justify-center rounded-lg border text-xs transition ${
                    !roomState.active_background_url
                      ? "border-emerald-500 bg-emerald-950/20 text-emerald-400 font-semibold"
                      : "border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-700"
                  }`}
                >
                  Fundo Escuro Padrão
                </button>
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => onUpdateRoom({ active_background_url: bg.file_url })}
                    className={`relative h-14 rounded-lg border overflow-hidden bg-neutral-950 transition ${
                      roomState.active_background_url === bg.file_url
                        ? "border-emerald-500 ring-1 ring-emerald-500"
                        : "border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bg.file_url!} alt={bg.title} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "captions" && (
          <>
            {/* Formulário Novo GC */}
            <form onSubmit={handleCreateGc} className="space-y-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
              <span className="text-xs font-semibold text-neutral-300 block">Novo Banner / GC</span>
              <input
                type="text"
                placeholder="Título principal (ex: Envie sua dúvida no Q&A)"
                value={newGcText}
                onChange={(e) => setNewGcText(e.target.value)}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Subtítulo opcional (ex: www.golive.com.br)"
                value={newGcSubtext}
                onChange={(e) => setNewGcSubtext(e.target.value)}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newGcText.trim()}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Adicionar GC
              </button>
            </form>

            {/* Lista de GCs cadastrados */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                Banners Salvos
              </span>
              {gcs.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">Nenhum GC criado ainda.</p>
              ) : (
                gcs.map((gc) => {
                  const isActive = roomState.active_banner_id === gc.id;
                  return (
                    <div
                      key={gc.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isActive
                          ? "border-emerald-500 bg-emerald-950/20"
                          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-medium text-neutral-100 truncate">{gc.title}</p>
                        {gc.subtitle && (
                          <p className="text-[11px] text-neutral-400 truncate">{gc.subtitle}</p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          onUpdateRoom({
                            active_banner_id: isActive ? null : gc.id,
                          })
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          isActive
                            ? "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                            : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                        }`}
                      >
                        {isActive ? "Ocultar" : "Exibir"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === "presentation" && (
          <StudioPresentationManager
            roomState={roomState}
            assets={assets}
            onUpdateRoom={onUpdateRoom}
            onCreateAsset={onCreateAsset}
          />
        )}
      </div>
    </div>
  );
}
