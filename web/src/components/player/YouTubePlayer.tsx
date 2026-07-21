"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Captions,
  CaptionsOff,
  Maximize,
  Pause,
  Play,
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
        onApiChange?: () => void;
      };
    },
  ) => YTPlayer;
}

function hasKeys(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && Object.keys(value as object).length > 0;
}

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
 * Progresso/voltar e legenda (Fase I.1) usam a mesma API — limites que não
 * são bug daqui: só dá pra voltar no vídeo se o YouTube expuser
 * `getDuration() > 0`, o que depende do DVR da transmissão ao vivo estar
 * habilitado do lado de quem está transmitindo.
 *
 * Legenda: testado num vídeo real em produção (print de tela) que
 * `cc_load_policy: 0` + limpar a faixa uma vez no `onReady` **não é
 * suficiente** — o YouTube reaplica a legenda automática (ASR) preferida
 * do espectador (conta/navegador dele) depois que o vídeo realmente começa
 * a tocar, não só no carregamento inicial. Por isso o intervalo de 500ms
 * (mesmo que já sincroniza `muted`/tempo) também reforça a limpeza a cada
 * tique enquanto `captionsOn` (intenção do usuário) for false — se ainda
 * assim aparecer legenda, não tem mais o que o embed consiga fazer, é
 * preferência de conta pessoal do Google do espectador.
 * Disponibilidade do botão: legenda automática/ASR **não aparece** em
 * `getOption("captions","tracklist")` (fica vazia), só em
 * `getOption("captions","track")`, mesmo sem nunca ter sido ativada por
 * ninguém — então a checagem usa os dois. `captionsOn` é estado local (o
 * que o usuário pediu no botão), não deriva de "track" — esse option
 * sempre retorna uma faixa "preferida" mesmo quando a legenda está
 * desligada de verdade.
 *
 * Sem seletor de qualidade: `setPlaybackQuality` é tratado pelo YouTube
 * como sugestão desde 2018 e, na prática, ele ignora o pedido tanto em
 * live quanto em VOD — testado e confirmado que não funciona mesmo fora
 * de live. Não existe forma de forçar a qualidade num embed do IFrame API
 * hoje; expor um controle que não controla nada só confundia.
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
  // duration > 0 só quando o YouTube permite voltar no vídeo (DVR da
  // transmissão) — se a live não permitir, fica 0 e a barra some sozinha
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  // espelha captionsOn pro intervalo de 500ms ler sem precisar recriar o
  // setInterval a cada toggle (fecharia sobre um valor desatualizado)
  const captionsOnRef = useRef(false);
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
          // sem isso, o YouTube pode herdar a preferência de legenda da
          // própria conta/navegador de quem está assistindo (cookie do
          // youtube.com) e exibir legenda sem ninguém ter pedido aqui
          cc_load_policy: 0,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setReady(true);
            // sem isso, getOption("captions","tracklist") nunca retorna
            // nada — o módulo precisa estar carregado pra API expor as
            // faixas disponíveis, mesmo só pra consulta
            playerRef.current?.loadModule("captions");
            // cc_load_policy:0 não é garantia (o dono do vídeo pode forçar
            // "sempre exibir legenda") — limpa a faixa ativa de novo aqui
            playerRef.current?.setOption("captions", "track", {});
          },
          onStateChange: (e) => {
            if (e.data === 1) setPhase("playing");
            else if (e.data === 2) setPhase("paused");
            else if (e.data === 3) setPhase("loading"); // carregando/buffer
            else if (e.data === 0) setPhase("cover"); // fim → capa (sem tela do YouTube)
          },
          onApiChange: () => {
            const player = playerRef.current;
            if (!player) return;
            const tracks = player.getOption("captions", "tracklist");
            const active = player.getOption("captions", "track");
            if ((Array.isArray(tracks) && tracks.length > 0) || hasKeys(active)) {
              setCaptionsAvailable(true);
            }
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

  // A disponibilidade de legenda fica pronta bem antes do vídeo começar a
  // tocar (testado: chega em ~500ms-2s só com o player pronto, sem
  // depender de "playing") — sondagem própria em vez de esperar a fase
  // "playing" pra não atrasar o botão aparecer. Checa tracklist (faixas
  // enviadas/traduzidas) E track (testado: legenda automática/ASR não
  // aparece na tracklist, só via getOption("captions","track"), mesmo
  // sem nunca ter sido ativada por ninguém).
  useEffect(() => {
    if (!ready || captionsAvailable) return;
    const player = playerRef.current;
    if (!player) return;
    const id = setInterval(() => {
      const tracks = player.getOption("captions", "tracklist");
      const active = player.getOption("captions", "track");
      if ((Array.isArray(tracks) && tracks.length > 0) || hasKeys(active)) {
        setCaptionsAvailable(true);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [ready, captionsAvailable]);

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
      // cc_load_policy:0 + limpar no onReady não é suficiente: testado que
      // o YouTube reaplica a legenda automática (ASR) da conta/navegador
      // do espectador depois que o vídeo começa a tocar de verdade — sem
      // reforçar aqui a cada tique, ela reaparece sozinha por conta própria
      if (!captionsOnRef.current && hasKeys(player.getOption("captions", "track"))) {
        player.setOption("captions", "track", {});
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);

  function commitSeek() {
    if (seekPreview === null) return;
    playerRef.current?.seekTo(seekPreview, true);
    setCurrentTime(seekPreview);
    setSeekPreview(null);
  }

  function toggleCaptions() {
    const player = playerRef.current;
    if (!player) return;
    if (captionsOn) {
      // limpa a faixa em vez de descarregar o módulo — unloadModule some
      // com o tracklist, e o botão não voltava a funcionar depois
      player.setOption("captions", "track", {});
      captionsOnRef.current = false;
      setCaptionsOn(false);
    } else {
      // setOption("captions","track", {}) pra LIGAR não faz nada — precisa
      // de uma faixa real. Prioriza a tracklist (faixas enviadas/
      // traduzidas); se estiver vazia (comum com legenda só automática/
      // ASR — testado que não aparece na tracklist), usa a faixa
      // "preferida" que o próprio YouTube já expõe em "track".
      const tracks = player.getOption("captions", "tracklist") as
        | { languageCode: string }[]
        | undefined;
      let target: { languageCode: string } | undefined;
      if (Array.isArray(tracks) && tracks.length > 0) {
        const lang = navigator.language?.toLowerCase() ?? "";
        target =
          tracks.find((t) => t.languageCode.toLowerCase() === lang) ??
          tracks.find((t) => lang.startsWith(t.languageCode.toLowerCase().split("-")[0])) ??
          tracks[0];
      } else {
        const current = player.getOption("captions", "track");
        if (hasKeys(current)) target = current as { languageCode: string };
      }
      if (!target) return;
      player.setOption("captions", "track", target);
      captionsOnRef.current = true;
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
        onClick={() => (phase === "playing" ? pause : play)()}
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
