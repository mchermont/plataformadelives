"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Captions,
  CaptionsOff,
  Maximize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  destroy(): void;
  isMuted(): boolean;
  getAvailableQualityLevels(): string[];
  getPlaybackQuality(): string;
  setPlaybackQuality(suggestedQuality: string): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadModule(module: string): void;
  unloadModule(module: string): void;
  setOption(module: string, option: string, value: unknown): void;
  getOption(module: string, option: string): unknown;
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
        onPlaybackQualityChange?: (e: { data: string }) => void;
        onApiChange?: () => void;
      };
    },
  ) => YTPlayer;
}

/** Rótulos pt-BR pros níveis de qualidade do YouTube (mais recentes primeiro). */
const QUALITY_LABELS: Record<string, string> = {
  highres: "Máxima",
  hd2160: "2160p",
  hd1440: "1440p",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
  auto: "Automática",
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
 *
 * Autoplay tenta iniciar com som (`mute: 0`); se o navegador bloquear
 * autoplay não-mudo, o player fica parado até o clique manual em
 * "Assistir" — aí sim é um gesto real do usuário e o som toca. O estado
 * `muted` é sempre sincronizado a partir de `player.isMuted()` (nunca
 * assumido), porque o navegador pode forçar mudo por conta própria.
 *
 * Qualidade, progresso/voltar e legenda (Fase I.1) usam a mesma API —
 * dois limites que não são bug daqui: (1) o YouTube pode ignorar
 * `setPlaybackQuality` e manter o ajuste automático por conta própria,
 * dependendo do vídeo; (2) só dá pra voltar no vídeo se o YouTube expuser
 * `getDuration() > 0`, o que depende do DVR da transmissão ao vivo estar
 * habilitado do lado de quem está transmitindo.
 */
export function YouTubePlayer({ videoId, title, coverUrl }: YouTubePlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [phase, setPhase] = useState<"cover" | "loading" | "playing" | "paused">(
    "loading",
  );
  const [ready, setReady] = useState(false);
  // tenta autoplay com som — se o navegador bloquear, o player fica parado
  // até o clique manual em "Assistir" (gesto real, som liberado nele)
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  // player já está tocando, mas o YouTube ainda pode mostrar logo/"mais
  // vídeos" por alguns segundos — só revela de verdade depois da folga
  const [revealed, setRevealed] = useState(false);
  const [quality, setQuality] = useState("auto");
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  // duration > 0 só quando o YouTube permite voltar no vídeo (DVR da
  // transmissão) — se a live não permitir, fica 0 e a barra some sozinha
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  // valor local durante o arraste da barra de progresso — só chama seekTo
  // no YouTube quando o usuário solta, em vez de a cada tique do drag
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

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
          mute: 0,
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
          onPlaybackQualityChange: (e) => setQuality(e.data),
          onApiChange: () => {
            const tracks = playerRef.current?.getOption("captions", "tracklist");
            setCaptionsAvailable(Array.isArray(tracks) && tracks.length > 0);
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

  // Progresso: só o YouTube sabe se essa transmissão permite voltar
  // (janela de DVR) — a barra some sozinha quando duration vem 0.
  useEffect(() => {
    if (phase !== "playing") return;
    const player = playerRef.current;
    if (!player) return;
    const id = setInterval(() => {
      setCurrentTime(player.getCurrentTime());
      setDuration(player.getDuration());
      // fonte da verdade pro mudo: o navegador pode forçar mudo mesmo
      // pedindo `mute: 0` no autoplay — sincroniza em vez de assumir
      setMuted(player.isMuted());
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  // Níveis de qualidade e disponibilidade de legenda só existem depois que
  // o YouTube já carregou algum formato — checa de novo a cada vez que volta
  // a tocar (leitura idempotente, sem custo perceptível).
  useEffect(() => {
    if (!ready || phase !== "playing") return;
    const player = playerRef.current;
    if (!player) return;
    const levels = player.getAvailableQualityLevels();
    if (levels.length > 0) setAvailableQualities(levels);
    const q = player.getPlaybackQuality();
    if (q) setQuality(q);
    const tracks = player.getOption("captions", "tracklist");
    setCaptionsAvailable(Array.isArray(tracks) && tracks.length > 0);
  }, [ready, phase]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);

  function commitSeek() {
    if (seekPreview === null) return;
    playerRef.current?.seekTo(seekPreview, true);
    setCurrentTime(seekPreview);
    setSeekPreview(null);
  }

  function setQualityLevel(level: string) {
    const player = playerRef.current;
    if (!player) return;
    player.setPlaybackQuality(level);
    setShowQualityMenu(false);
    // o YouTube pode ignorar o pedido e manter automático — confirma com o
    // valor real do player em vez de assumir que a troca funcionou
    setTimeout(() => {
      const actual = player.getPlaybackQuality();
      if (actual) setQuality(actual);
    }, 1000);
  }

  function toggleCaptions() {
    const player = playerRef.current;
    if (!player) return;
    if (captionsOn) {
      player.unloadModule("captions");
      setCaptionsOn(false);
    } else {
      player.loadModule("captions");
      player.setOption("captions", "track", {});
      setCaptionsOn(true);
    }
  }

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
        onClick={() => {
          setShowQualityMenu(false);
          (phase === "playing" ? pause : play)();
        }}
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
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-10 opacity-0 transition group-hover:opacity-100">
          {duration > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-white/80">
                {formatTime(seekPreview ?? currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={Math.min(seekPreview ?? currentTime, duration)}
                onChange={(e) => setSeekPreview(Number(e.target.value))}
                onMouseUp={commitSeek}
                onTouchEnd={commitSeek}
                onKeyUp={commitSeek}
                aria-label="Progresso do vídeo"
                className="h-1 w-full accent-[var(--brand,#0284c7)]"
              />
              <span className="text-[10px] tabular-nums text-white/80">
                {formatTime(duration)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
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
            {captionsAvailable && (
              <button
                onClick={toggleCaptions}
                aria-label={captionsOn ? "Desativar legendas" : "Ativar legendas"}
                aria-pressed={captionsOn}
                className={captionsOn ? "text-white" : "text-white/70 hover:opacity-80"}
              >
                {captionsOn ? <Captions className="size-4" /> : <CaptionsOff className="size-4" />}
              </button>
            )}
            {availableQualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu((v) => !v)}
                  aria-label="Qualidade do vídeo"
                  aria-expanded={showQualityMenu}
                  className="flex items-center gap-1 text-white hover:opacity-80"
                >
                  <Settings className="size-4" />
                  <span className="text-[11px] font-medium">
                    {QUALITY_LABELS[quality] ?? quality}
                  </span>
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 z-40 mb-2 min-w-28 overflow-hidden rounded-lg bg-neutral-900 py-1 text-sm shadow-2xl ring-1 ring-white/10">
                    {availableQualities.map((level) => (
                      <button
                        key={level}
                        onClick={() => setQualityLevel(level)}
                        className={`block w-full px-3 py-1.5 text-left hover:bg-white/10 ${
                          level === quality ? "font-semibold text-[var(--brand,#0284c7)]" : "text-white"
                        }`}
                      >
                        {QUALITY_LABELS[level] ?? level}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
        </div>
      )}
    </div>
  );
}
