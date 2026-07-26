"use client";

import { useState } from "react";
import { Radio, Plus, Trash2, Eye, EyeOff, Pencil, X, Check, Copy } from "lucide-react";
import type { StudioRoom, StudioStreamDestination } from "@/lib/types";

interface StudioStreamPanelProps {
  roomState: StudioRoom;
  destinations: StudioStreamDestination[];
  onCreateDestination: (data: Partial<StudioStreamDestination>) => void;
  onUpdateDestination: (id: string, data: Partial<StudioStreamDestination>) => void;
  onDeleteDestination: (id: string) => void;
  onStartStream: () => void;
  onStopStream: () => void;
  onCopyOutputLink: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  starting: "Preparando…",
  active: "Ao vivo",
  stopping: "Encerrando…",
  error: "Erro",
};

function emptyForm() {
  return { name: "", rtmp_url: "", stream_key: "" };
}

export function StudioStreamPanel({
  roomState,
  destinations,
  onCreateDestination,
  onUpdateDestination,
  onDeleteDestination,
  onStartStream,
  onStopStream,
  onCopyOutputLink,
}: StudioStreamPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const enabledCount = destinations.filter((d) => d.enabled).length;
  const status = roomState.egress_status;
  const isBusy = status === "starting" || status === "stopping";
  const isLive = status === "active";

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.rtmp_url.trim() || !form.stream_key.trim()) return;
    onCreateDestination({
      name: form.name.trim(),
      rtmp_url: form.rtmp_url.trim(),
      stream_key: form.stream_key.trim(),
      enabled: true,
    });
    setForm(emptyForm());
    setShowForm(false);
  };

  const startEdit = (d: StudioStreamDestination) => {
    setEditingId(d.id);
    setEditForm({ name: d.name, rtmp_url: d.rtmp_url, stream_key: d.stream_key });
  };

  const saveEdit = (id: string) => {
    if (!editForm.name.trim() || !editForm.rtmp_url.trim() || !editForm.stream_key.trim()) return;
    onUpdateDestination(id, {
      name: editForm.name.trim(),
      rtmp_url: editForm.rtmp_url.trim(),
      stream_key: editForm.stream_key.trim(),
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Controle de transmissão */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" /> Transmissão ao vivo
          </span>
          {status && (
            <span
              className={`text-[11px] font-semibold ${
                status === "error"
                  ? "text-red-400"
                  : status === "active"
                    ? "text-emerald-400"
                    : "text-amber-400"
              }`}
            >
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>

        {roomState.egress_error && <p className="text-[11px] text-red-400">{roomState.egress_error}</p>}

        <button
          onClick={isLive || status === "starting" ? onStopStream : onStartStream}
          disabled={isBusy || (!isLive && enabledCount === 0)}
          className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            isLive || status === "starting"
              ? "bg-red-500 text-white hover:bg-red-400"
              : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
          }`}
        >
          {isLive || status === "starting" ? "Encerrar transmissão" : "Iniciar transmissão"}
        </button>

        <p className="text-[11px] text-neutral-500">
          {enabledCount === 0
            ? "Cadastre um destino habilitado abaixo pra poder transmitir."
            : `${enabledCount} destino${enabledCount > 1 ? "s" : ""} habilitado${enabledCount > 1 ? "s" : ""}.`}
        </p>

        <button
          onClick={onCopyOutputLink}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-neutral-800 py-1.5 text-[11px] font-semibold text-neutral-300 transition hover:bg-neutral-800"
        >
          <Copy className="h-3 w-3 text-amber-400" /> Copiar link de Output (OBS/vMix)
        </button>
      </div>

      {/* Lista de destinos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">Destinos RTMP</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Adicionar destino
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmitNew}
            className="space-y-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800"
          >
            <input
              type="text"
              placeholder="Nome (ex: YouTube)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="URL RTMP (ex: rtmp://a.rtmp.youtube.com/live2)"
              value={form.rtmp_url}
              onChange={(e) => setForm((f) => ({ ...f, rtmp_url: e.target.value }))}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Chave de stream"
              value={form.stream_key}
              onChange={(e) => setForm((f) => ({ ...f, stream_key: e.target.value }))}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!form.name.trim() || !form.rtmp_url.trim() || !form.stream_key.trim()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Salvar destino
            </button>
          </form>
        )}

        {destinations.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">Nenhum destino cadastrado ainda.</p>
        ) : (
          destinations.map((d) => {
            const isEditing = editingId === d.id;
            const revealed = revealedIds.has(d.id);
            if (isEditing) {
              return (
                <div key={d.id} className="space-y-2 bg-neutral-950 p-3 rounded-xl border border-emerald-500/60">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editForm.rtmp_url}
                    onChange={(e) => setEditForm((f) => ({ ...f, rtmp_url: e.target.value }))}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editForm.stream_key}
                    onChange={(e) => setEditForm((f) => ({ ...f, stream_key: e.target.value }))}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(d.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-emerald-400"
                    >
                      <Check className="h-3.5 w-3.5" /> Salvar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-neutral-800 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={d.id}
                className={`p-3 rounded-xl border transition ${
                  d.enabled ? "border-neutral-800 bg-neutral-950" : "border-neutral-800/50 bg-neutral-950/50 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-neutral-100 truncate">{d.name}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onUpdateDestination(d.id, { enabled: !d.enabled })}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                        d.enabled
                          ? "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      {d.enabled ? "Habilitado" : "Desabilitado"}
                    </button>
                    <button
                      onClick={() => startEdit(d)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteDestination(d.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:bg-red-950/40 hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 truncate mt-1">{d.rtmp_url}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-[11px] text-neutral-500 truncate">
                    {revealed ? d.stream_key : "•".repeat(Math.min(d.stream_key.length, 24))}
                  </p>
                  <button
                    onClick={() => toggleReveal(d.id)}
                    className="text-neutral-500 hover:text-neutral-300 flex-shrink-0"
                    title={revealed ? "Ocultar chave" : "Mostrar chave"}
                  >
                    {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
