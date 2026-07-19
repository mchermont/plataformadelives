"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventPhoto } from "@/lib/types";
import { Lightbox } from "@/components/event/Lightbox";

/** Moderação da galeria no Diretor: fila de aprovação + fotos publicadas. */
export function GalleryManager({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("event_photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setPhotos((data as EventPhoto[]) ?? []);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-photos:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_photos", filter: `event_id=eq.${eventId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, load]);

  function publicUrl(path: string) {
    return supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl;
  }

  async function setStatus(photo: EventPhoto, status: EventPhoto["status"]) {
    await supabase.from("event_photos").update({ status }).eq("id", photo.id);
    await load();
  }

  async function remove(photo: EventPhoto) {
    // apaga o arquivo também (operador tem delete no bucket)
    await supabase.storage.from("gallery").remove([photo.storage_path]);
    await supabase.from("event_photos").delete().eq("id", photo.id);
    await load();
  }

  const pending = photos.filter((p) => p.status === "pending");
  const approved = photos.filter((p) => p.status === "approved");

  return (
    <div className="flex h-full flex-col overflow-y-auto p-2.5">
      {pending.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-900 bg-amber-950/30 p-2.5">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Fila de moderação ({pending.length})
          </h4>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <button
                  onClick={() => setZoom(publicUrl(p.storage_path))}
                  aria-label="Ampliar foto"
                  className="shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrl(p.storage_path)}
                    alt=""
                    loading="lazy"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-neutral-200">
                    {p.author_name || "Participante"}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {new Date(p.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    <button
                      onClick={() => setStatus(p, "approved")}
                      className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                    >
                      ✓ Aprovar
                    </button>
                    <button
                      onClick={() => setStatus(p, "rejected")}
                      className="rounded border border-red-900 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-950"
                    >
                      ✕ Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approved.length === 0 && pending.length === 0 && (
        <p className="pt-8 text-center text-[13px] text-neutral-500">
          Nenhuma foto enviada ainda.
        </p>
      )}

      {approved.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Publicadas ({approved.length})
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            {approved.map((p) => (
              <div key={p.id} className="group relative aspect-square">
                <button
                  onClick={() => setZoom(publicUrl(p.storage_path))}
                  aria-label="Ampliar foto"
                  className="block h-full w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrl(p.storage_path)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full rounded-lg object-cover"
                  />
                </button>
                <span className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-black/70 px-1.5 text-[10px] text-neutral-200">
                  {p.author_name || "Participante"}
                </span>
                <button
                  onClick={() => remove(p)}
                  title="Apagar foto"
                  aria-label="Apagar foto"
                  className="absolute right-1 top-1 hidden rounded bg-black/70 px-1.5 text-xs text-white group-hover:block"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
