"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Mic, Video, User, Check, ArrowRight } from "lucide-react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";

export default function GuestStudioPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;
  const eventSlug = params?.eventSlug as string;

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      // Usa id temporário do participante convidado
      const guestIdentity = `guest-${Math.random().toString(36).substring(2, 9)}`;
      const res = await fetch(
        `/api/studio/token?eventId=${eventSlug}&identity=${guestIdentity}&name=${encodeURIComponent(
          name
        )}`
      );
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setServerUrl(data.serverUrl);
        setJoined(true);
      }
    } catch (err) {
      console.error("Erro ao entrar no estúdio:", err);
    } finally {
      setLoading(false);
    }
  };

  if (joined && token && serverUrl) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={true}
        audio={true}
        className="flex h-screen w-full flex-col items-center justify-center bg-neutral-950 text-neutral-100 p-6 text-center space-y-4"
      >
        <RoomAudioRenderer />
        <div className="h-16 w-16 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold">Você está conectado ao Estúdio!</h1>
        <p className="max-w-md text-sm text-neutral-400">
          Sua câmera e microfone estão ativos. Você está no **Backstage**. O diretor colocará você no palco no momento certo da live.
        </p>
      </LiveKitRoom>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-2xl backdrop-blur-md">
        <div className="text-center space-y-2 mb-6">
          <span className="inline-block rounded-full bg-emerald-950 border border-emerald-800 px-3 py-1 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Green Room / Sala de Espera
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">Entrar no Estúdio</h1>
          <p className="text-xs text-neutral-400">
            Digite seu nome como deseja ser identificado na transmissão.
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
              placeholder="Ex: Ana Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            ) : (
              <>
                Entrar na Sala do Estúdio <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
