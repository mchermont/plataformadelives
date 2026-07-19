"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * capa de volta na pausa/fim (esconde a logo de pausa). Limite conhecido:
 * os termos do YouTube não permitem remover 100% a marca.
 */
export function YouTubePlayer({ videoId, title, coverUrl }: YouTubePlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [phase, setPhase] = useState<"cover" | "playing" | "paused">("cover");
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true); // autoplay exige começar mudo
  const [volume, setVolume] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);

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
          tooltip de URL). Zoom + overflow-hidden empurra o título/logo do
          YouTube (fora da faixa central) para fora da área visível. */}
      <div className="absolute inset-0 overflow-hidden [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full">
        <div
          ref={hostRef}
          className="h-full w-full scale-[1.18]"
          style={{ transformOrigin: "center" }}
        />
      </div>

      {/* bloqueia cliques na UI do YouTube (logo, título, sugestões) */}
      <div
        className="absolute inset-0 z-10"
        onClick={phase === "playing" ? pause : play}
      />

      {phase !== "playing" && (
        <button
          onClick={play}
          disabled={!ready}
          aria-label="Assistir"
          className="absolute inset-0 z-20 flex items-center justify-center bg-black"
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span className="absolute inset-0 bg-black/40" />
          <span
            className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full pl-1 text-2xl text-white shadow-2xl transition group-hover:scale-110 sm:h-20 sm:w-20 sm:text-3xl"
            style={{ background: "var(--brand, #0284c7)" }}
          >
            ▶
          </span>
          {!coverUrl && (
            <span className="absolute bottom-4 left-4 right-4 z-10 truncate text-left text-sm text-neutral-300">
              {title}
            </span>
          )}
        </button>
      )}

      {phase === "playing" && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-10 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={pause}
            aria-label="Pausar"
            className="text-lg text-white hover:opacity-80"
          >
            ⏸
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? "Ativar som" : "Silenciar"}
            className="text-lg text-white hover:opacity-80"
          >
            {muted || volume === 0 ? "🔇" : "🔊"}
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
            className="text-lg text-white hover:opacity-80"
          >
            ⛶
          </button>
        </div>
      )}
    </div>
  );
}
