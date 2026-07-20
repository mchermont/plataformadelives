"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onStateChange: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  coverUrl?: string | null;
}

/**
 * Player white-label (Fase I): YouTube IFrame API com controls=0, capa
 * própria antes do play, overlay bloqueando cliques na UI do YouTube e
 * tela de "Carregando vídeo" (desfoque) durante buffer/pausa/fim — sem
 * cortar a imagem. Limite conhecido: os termos do YouTube não permitem
 * remover 100% a marca.
 */
export function YouTubePlayer({ videoId, title, coverUrl }: YouTubePlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [phase, setPhase] = useState<"cover" | "loading" | "playing" | "paused">(
    "loading",
  );
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true); // autoplay exige começar mudo
  const [volume, setVolume] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  // player já está tocando, mas o YouTube ainda pode mostrar logo/"mais
  // vídeos" por alguns segundos — só revela de verdade depois da folga
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let disposed = false;
    loadApi().then((YT) => {
      if (disposed || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            if (e.data === 1) setPhase("playing");
            else if (e.data === 2) setPhase("paused");
            else if (e.data === 3) setPhase("loading"); // carregando/buffer
            else if (e.data === 0) setPhase("cover"); // fim → capa (sem tela do YouTube)
          },
        },
      });
    });
    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Se o autoplay travar (bloqueado pelo navegador), some o spinner e volta
  // pro botão de play manual em vez de carregar pra sempre.
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(
      () => setPhase((p) => (p === "loading" ? "cover" : p)),
      4000,
    );
    return () => clearTimeout(t);
  }, [phase]);

  // Mantém a tela de carregamento por 4s depois de "playing" de verdade
  // (autoplay ou retomar do pause) — dá tempo do logo/"mais vídeos" do
  // YouTube sumir antes de revelar o vídeo por trás do nosso overlay.
  useEffect(() => {
    if (phase !== "playing") {
      setRevealed(false);
      return;
    }
    const t = setTimeout(() => setRevealed(true), 4000);
    return () => clearTimeout(t);
  }, [phase]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);

  function toggleMute() {
    if (muted) {
      playerRef.current?.unMute();
      setMuted(false);
    } else {
      playerRef.current?.mute();
      setMuted(true);
    }
  }

  function changeVolume(v: number) {
    setVolume(v);
    playerRef.current?.setVolume(v);
    if (v > 0 && muted) {
      playerRef.current?.unMute();
      setMuted(false);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen();
  }

  return (
    <div
      ref={wrapRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`group relative w-full select-none overflow-hidden bg-black ${
        fullscreen ? "h-full" : "aspect-video rounded-xl"
      }`}
    >
      {/* pointer-events-none: nenhum hover/clique chega ao YouTube (sem
          tooltip de URL) — todo controle é nosso via API. */}
      <div className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full">
        <div ref={hostRef} className="h-full w-full" />
      </div>

      {/* bloqueia cliques na UI do YouTube (logo, título, sugestões) */}
      <div
        className="absolute inset-0 z-10"
        onClick={phase === "playing" ? pause : play}
      />

      {(phase === "cover" || phase === "paused") && (
        <button
          onClick={play}
          disabled={!ready}
          aria-label="Assistir"
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-2xl"
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span
            className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full pl-1 text-white shadow-2xl transition group-hover:scale-110 sm:h-20 sm:w-20"
            style={{ background: "var(--brand, #0284c7)" }}
          >
            <Play className="size-7 fill-current sm:size-9" />
          </span>
          {!coverUrl && (
            <span className="absolute bottom-4 left-4 right-4 z-10 truncate text-left text-sm text-neutral-300">
              {title}
            </span>
          )}
        </button>
      )}

      {/* carregando/buffer + folga pós-play: desfoque + spinner, sem
          revelar a UI do YouTube (logo/"mais vídeos" somem por trás) */}
      {(phase === "loading" || (phase === "playing" && !revealed)) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-2xl">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
          <p className="text-sm font-medium text-white/90">Carregando vídeo…</p>
        </div>
      )}

      {phase === "playing" && revealed && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-10 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={pause}
            aria-label="Pausar"
            className="text-white hover:opacity-80"
          >
            <Pause className="size-5 fill-current" />
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? "Ativar som" : "Silenciar"}
            className="text-white hover:opacity-80"
          >
            {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Volume"
            className="h-1 w-24 accent-[var(--brand,#0284c7)]"
          />
          <span className="ml-auto rounded bg-red-600 px-1.5 text-[10px] font-bold uppercase text-white">
            ● Ao vivo
          </span>
          <button
            onClick={toggleFullscreen}
            aria-label="Tela cheia"
            className="text-white hover:opacity-80"
          >
            <Maximize className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
