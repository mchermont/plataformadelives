"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EventMaterial } from "@/lib/types";

/** Ícone por tipo de arquivo (componente, não string — uso: `<Icon className=... />`). */
export function fileIcon(mime: string, name: string) {
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("presentation") || /\.pptx?$/i.test(name)) return Presentation;
  if (mime.includes("sheet") || /\.xlsx?$/i.test(name)) return FileSpreadsheet;
  if (mime.includes("word") || /\.docx?$/i.test(name)) return FileText;
  return File;
}

export function formatSize(bytes: number) {
  if (bytes <= 0) return "";
  const mb = bytes / 1048576;
  if (mb >= 1) {
    return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Materiais visíveis da sala, com realtime (aba só aparece se houver algum). */
export function useMaterials(eventId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [materials, setMaterials] = useState<EventMaterial[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("event_materials")
      .select("*")
      .eq("event_id", eventId)
      .eq("visible", true)
      .order("created_at", { ascending: true });
    setMaterials((data as EventMaterial[]) ?? []);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`materials:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_materials", filter: `event_id=eq.${eventId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, load]);

  return materials;
}

/** Aba "Materiais" da sala: lista para download. */
export function MaterialsPanel({ materials }: { materials: EventMaterial[] }) {
  const supabase = useMemo(() => createClient(), []);

  function downloadUrl(m: EventMaterial) {
    return supabase.storage
      .from("materials")
      .getPublicUrl(m.storage_path, { download: m.file_name }).data.publicUrl;
  }

  return (
    <div className="h-full space-y-1.5 overflow-y-auto p-2.5">
      {materials.map((m) => {
        const Icon = fileIcon(m.mime_type, m.file_name);
        return (
          <a
            key={m.id}
            href={downloadUrl(m)}
            className="flex items-center gap-2.5 rounded-lg border border-neutral-800 px-3 py-2 transition hover:bg-neutral-800/50"
          >
            <Icon className="size-5 shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-neutral-200">
                {m.title}
              </span>
              <span className="block text-[11px] text-neutral-500">
                {m.file_name}
                {m.file_size > 0 && ` · ${formatSize(m.file_size)}`}
              </span>
            </span>
            <Download className="size-4 shrink-0 text-neutral-400" />
          </a>
        );
      })}
      {materials.length === 0 && (
        <p className="pt-8 text-center text-[13px] text-neutral-500">
          Nenhum material disponível.
        </p>
      )}
    </div>
  );
}
