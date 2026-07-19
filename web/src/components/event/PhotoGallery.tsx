"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventPhoto } from "@/lib/types";

interface PhotoGalleryProps {
  eventId: string;
  userId: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (mesmo limite do bucket)

/** Galeria da sala: envio pelo participante + grade de fotos aprovadas. */
export function PhotoGallery({ eventId, userId }: PhotoGalleryProps) {
  const supabase = useMemo(() => createClient(), []);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      .channel(`photos:${eventId}`)
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

  async function upload(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato não suportado — envie JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("A foto é muito grande (máx. 10 MB).");
      return;
    }
    setBusy(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${eventId}/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upError } = await supabase.storage.from("gallery").upload(path, file);
    if (upError) {
      setError("Não foi possível enviar a foto. Tente novamente.");
    } else {
      const { data, error: rpcError } = await supabase.rpc("submit_photo", {
        p_event_id: eventId,
        p_path: path,
      });
      if (rpcError) {
        // mensagens do banco já vêm em pt-BR (ex.: limite de 10 fotos)
        setError(rpcError.message);
      } else if (data) {
        setPhotos((prev) => [data as EventPhoto, ...prev]);
      }
    }
    setBusy(false);
  }

  async function removeOwn(photo: EventPhoto) {
    await supabase.from("event_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  // aprovadas para todos + as próprias pendentes (com selo); recusadas somem
  const visible = photos.filter(
    (p) =>
      p.status === "approved" ||
      (p.author_id === userId && p.status === "pending"),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 p-2">
        {error && <p className="mb-1.5 text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.join(",")}
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
            className="rounded-lg bg-[var(--brand,#0284c7)] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Enviando…" : "📷 Enviar foto"}
          </button>
          <span className="text-[11px] text-neutral-500">
            As fotos passam por aprovação antes de aparecer.
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="pt-8 text-center text-[13px] text-neutral-500">
            Nenhuma foto ainda. Envie a primeira!
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {visible.map((p) => (
              <div key={p.id} className="group relative aspect-square">
                <a
                  href={publicUrl(p.storage_path)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrl(p.storage_path)}
                    alt=""
                    loading="lazy"
                    className={`h-full w-full rounded-lg object-cover ${
                      p.status === "pending" ? "opacity-50" : ""
                    }`}
                  />
                </a>
                {p.status === "pending" && (
                  <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 text-[10px] font-semibold text-black">
                    em moderação
                  </span>
                )}
                {p.author_id === userId && (
                  <button
                    onClick={() => removeOwn(p)}
                    title="Remover minha foto"
                    aria-label="Remover minha foto"
                    className="absolute right-1 top-1 hidden rounded bg-black/70 px-1.5 text-xs text-white group-hover:block"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
