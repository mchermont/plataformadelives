"use client";

import type { StreamProvider } from "@/lib/types";
import { YouTubePlayer } from "./YouTubePlayer";

interface StreamPlayerProps {
  provider: StreamProvider;
  streamRef: string;
  title: string;
  /** capa exibida antes do play (player white-label, Fase I) */
  coverUrl?: string | null;
}

/** Extrai o ID de vídeo do YouTube de uma URL (watch, live, youtu.be) ou devolve o próprio valor. */
function youTubeId(ref: string): string {
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/))([\w-]{6,})/,
    /youtu\.be\/([\w-]{6,})/,
  ];
  for (const p of patterns) {
    const m = ref.match(p);
    if (m) return m[1];
  }
  return ref;
}

/** Extrai o ID numérico do Vimeo de uma URL ou devolve o próprio valor. */
function vimeoId(ref: string): string {
  const m = ref.match(/vimeo\.com\/(?:event\/)?(\d+)/);
  return m ? m[1] : ref;
}

function embedSrc(provider: StreamProvider, ref: string): string | null {
  switch (provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${youTubeId(ref)}?autoplay=1&rel=0`;
    case "vimeo": {
      // Eventos de live do Vimeo usam /event/{id}/embed
      if (ref.includes("/event/")) {
        return `https://vimeo.com/event/${vimeoId(ref)}/embed`;
      }
      return `https://player.vimeo.com/video/${vimeoId(ref)}?autoplay=1`;
    }
    case "dacast":
      // Dacast fornece a URL completa do iframe no painel deles
      return ref.startsWith("http") ? ref : null;
    case "hls":
      return null; // fase 2
  }
}

export function StreamPlayer({ provider, streamRef, title, coverUrl }: StreamPlayerProps) {
  const src = embedSrc(provider, streamRef);

  // YouTube: player white-label (IFrame API, controles próprios).
  // Detecta link do YouTube mesmo com provider errado no cadastro.
  if (provider === "youtube" || /youtu\.?be/.test(streamRef)) {
    return (
      <YouTubePlayer videoId={youTubeId(streamRef)} title={title} coverUrl={coverUrl} />
    );
  }

  if (provider === "hls") {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-neutral-900 text-neutral-400">
        <p className="max-w-sm text-center text-sm">
          Transmissão pelo servidor próprio (HLS) chega na fase 2. Configure o
          evento com YouTube, Vimeo ou Dacast por enquanto.
        </p>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-neutral-900 text-neutral-400">
        <p className="text-sm">Fonte de vídeo não configurada.</p>
      </div>
    );
  }

  return (
    <iframe
      className="aspect-video w-full rounded-xl bg-black"
      src={src}
      title={title}
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
    />
  );
}
