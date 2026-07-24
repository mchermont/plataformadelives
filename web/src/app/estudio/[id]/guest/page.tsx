"use client";

import { useEffect, useState } from "react";
import { Check, ArrowRight, Mic, Video } from "lucide-react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then((m) => m.LiveKitRoom),
  { ssr: false }
);
const RoomAudioRenderer = dynamic(
  () => import("@livekit/components-react").then((m) => m.RoomAudioRenderer),
  { ssr: false }
);

export default function GuestRoomPage() {
  const params = useParams();
  // Suporte a /estudio/[id]/guest (id = UUID do evento)
  const eventId = params?.id as string;

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !eventId) return;

    setLoading(true);
    setError(null);
    try {
      const guestIdentity = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetch(
        `/api/studio/token?eventId=${eventId}&identity=${guestIdentity}&name=${encodeURIComponent(name)}`
      );
      const data = await res.json();
      if (data.token && data.serverUrl) {
        setToken(data.token);
        setServerUrl(data.serverUrl);
        setJoined(true);
      } else {
        setError(data.error || "Não foi possível entrar. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao entrar:", err);
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (joined && token && serverUrl) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={true}
        audio={true}
        onError={(err) => console.error("Guest LiveKit error:", err)}
        className="flex h-screen w-full flex-col items-center justify-center bg-neutral-950 text-neutral-100 p-6 text-center gap-5"
      >
        <RoomAudioRenderer />

        {/* Preview da câmera do convidado */}
        <div className="w-64 h-48 rounded-2xl overflow-hidden border border-emerald-700 bg-neutral-900">
          <video
            autoPlay
            muted
            playsInline
            ref={(el) => {
              if (!el) return;
              navigator.mediaDevices
                .getUserMedia({ video: true })
                .then((stream) => {
                  el.srcObject = stream;
                })
                .catch(() => {});
            }}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="h-14 w-14 rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
          <Check className="h-7 w-7" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold">Você está no Backstage!</h1>
          <p className="max-w-sm text-sm text-neutral-400">
            Sua câmera e microfone estão ativos. O diretor irá colocá-lo no palco quando for a hora certa.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800 px-3 py-1.5">
            <Mic className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">Microfone ativo</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800 px-3 py-1.5">
            <Video className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">Câmera ativa</span>
          </div>
        </div>

        <p className="text-xs text-neutral-600 mt-4">
          Conectado como: <strong className="text-neutral-400">{name}</strong>
        </p>
      </LiveKitRoom>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/80 p-7 shadow-2xl backdrop-blur-md">
        <div className="text-center space-y-2 mb-7">
          <span className="inline-block rounded-full bg-emerald-950 border border-emerald-800 px-3 py-1 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            🎬 Green Room
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-100">
            Entrar no Estúdio
          </h1>
          <p className="text-xs text-neutral-400">
            Digite seu nome para entrar na sala e aguardar no backstage.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Seu Nome Completo
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            ) : (
              <>
                Entrar no Backstage <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
