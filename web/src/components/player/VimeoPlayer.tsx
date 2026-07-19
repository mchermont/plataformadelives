"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isVimeoLiveEvent, vimeoId } from "./StreamPlayer";

interface VimeoPlayerInstance {
  play(): Promise<void>;
  pause(): Promise<void>;
  setVolume(level: number): Promise<number>;
  ready(): Promise<void>;
  on(event: string, cb: () => void): void;
  destroy(): Promise<void>;
}

interface VimeoNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      id?: string;
      url?: string;
      width?: string;
      height?: string;
      autoplay: boolean;
      muted: boolean;
      controls: boolean;
      title: boolean;
      byline: boolean;
      portrait: boolean;
      dnt: boolean;
      playsinline: boolean;
    },
  ) => VimeoPlayerInstance;
}

declare global {
  interface Window {
    Vimeo?: VimeoNamespace;
  }
}

let apiPromise: Promise<VimeoNamespace> | null = null;
function loadApi(): Promise<VimeoNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.Vimeo?.Player) return resolve(window.Vimeo);
    const script = document.createElement("script");
    script.src = "https://player.vimeo.com/api/player.js";
    script.onload = () => resolve(window.Vimeo!);
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface VimeoPlayerProps {
  streamRef: string;
  title: string;
  coverUrl?: string | null;
}

/**
 * Player white-label (Fase I): Vimeo Player.js com controls/title/byline/
 * portrait desligados, capa própria, overlay bloqueando cliques/hover no
 * iframe e zoom+crop empurrando qualquer chrome residual pra fora da área
 * visível. Mesma abordagem do YouTubePlayer.
 */
export function VimeoPlayer({ streamRef, title, coverUrl }: VimeoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VimeoPlayerInstance | null>(null);
  const [phase, setPhase] = useState<"cover" | "playing" | "paused">("cover");
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true); // autoplay exige começar mudo
  const [volume, setVolume] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let disposed = false;
    loadApi().then((Vimeo) => {
      if (disposed || !hostRef.current) return;
      const isEvent = isVimeoLiveEvent(streamRef);
      playerRef.current = new Vimeo.Player(hostRef.current, {
        ...(isEvent ? { url: streamRef } : { id: vimeoId(streamRef) }),
        width: "100%",
        height: "100%",
        autoplay: true,
        muted: true,
        controls: false,
        title: false,
        byline: false,
        portrait: false,
        dnt: true,
        playsinline: true,
      });
      playerRef.current.ready().then(() => setReady(true));
      playerRef.current.on("play", () => setPhase("playing"));
      playerRef.current.on("pause", () => setPhase("paused"));
      playerRef.current.on("ended", () => setPhase("cover"));
    });
    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [streamRef]);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const play = useCallback(() => playerRef.current?.play(), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);

  function toggleMute() {
    if (muted) {
      playerRef.current?.setVolume(volume / 100);
      setMuted(false);
    } else {
      playerRef.current?.setVolume(0);
      setMuted(true);
    }
  }

  function changeVolume(v: number) {
    setVolume(v);
    playerRef.current?.setVolume(v / 100);
    if (v > 0) setMuted(false);
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
      <div className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full">
        <div ref={hostRef} className="h-full w-full" />
      </div>

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
