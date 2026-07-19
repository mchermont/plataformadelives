"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventMaterial } from "@/lib/types";
import { fileIcon, formatSize } from "@/components/event/Materials";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB (mesmo limite do bucket)

/** Gestão de materiais do evento: upload, visibilidade e exclusão. */
export function MaterialsManager({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [materials, setMaterials] = useState<EventMaterial[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("event_materials")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    setMaterials((data as EventMaterial[]) ?? []);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_SIZE) {
      setError("Arquivo muito grande (máx. 100 MB).");
      return;
    }
    setBusy(true);
    const safeName = file.name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${eventId}/${crypto.randomUUID()}-${safeName}`;
    const { error: upError } = await supabase.storage
      .from("materials")
      .upload(path, file);
    if (upError) {
      setError("Não foi possível enviar o arquivo.");
    } else {
      const { error: insError } = await supabase.from("event_materials").insert({
        event_id: eventId,
        title: file.name.replace(/\.[^.]+$/, ""),
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        added_by: userId,
      });
      if (insError) setError("Arquivo enviado, mas não foi possível registrar.");
      await load();
    }
    setBusy(false);
  }

  async function toggleVisible(m: EventMaterial) {
    await supabase
      .from("event_materials")
      .update({ visible: !m.visible })
      .eq("id", m.id);
    await load();
  }

  async function rename(m: EventMaterial) {
    const title = prompt("Nome exibido para os participantes:", m.title);
    if (title === null) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    await supabase.from("event_materials").update({ title: trimmed }).eq("id", m.id);
    await load();
  }

  async function remove(m: EventMaterial) {
    if (!confirm(`Apagar "${m.title}"?`)) return;
    await supabase.storage.from("materials").remove([m.storage_path]);
    await supabase.from("event_materials").delete().eq("id", m.id);
    await load();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Materiais para download</h2>
          <p className="text-sm text-neutral-400">
            PPT, PDF, vídeo, imagem, áudio.{" "}
            <span className="font-medium text-amber-400">
              Novos arquivos entram ocultos — clique em “Exibir” para aparecer
              na sala.
            </span>
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {busy ? "Enviando…" : "+ Enviar arquivo"}
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      {materials.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
          Nenhum material enviado ainda.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {materials.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2"
            >
              <span className="text-xl">{fileIcon(m.mime_type, m.file_name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-200">
                  {m.title}
                </p>
                <p className="text-xs text-neutral-500">
                  {m.file_name}
                  {m.file_size > 0 && ` · ${formatSize(m.file_size)}`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.visible
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {m.visible ? "Visível na sala" : "Oculto da sala"}
              </span>
              <button
                onClick={() => toggleVisible(m)}
                className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-800"
              >
                {m.visible ? "Ocultar" : "Exibir"}
              </button>
              <button
                onClick={() => rename(m)}
                title="Renomear"
                className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-800"
              >
                ✏️
              </button>
              <button
                onClick={() => remove(m)}
                title="Apagar"
                className="shrink-0 rounded-lg border border-red-900 px-2.5 py-1 text-xs text-red-400 hover:bg-red-950"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
