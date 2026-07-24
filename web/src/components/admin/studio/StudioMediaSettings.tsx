"use client";

import { useState } from "react";
import { useMediaDeviceSelect, useRoomContext } from "@livekit/components-react";
import { Camera, Mic, Volume2, Wind, X } from "lucide-react";
import type { StudioVolumeMap } from "./StudioAudioRenderer";

interface RemoteVolumeTarget {
  identity: string;
  name: string;
}

interface StudioMediaSettingsProps {
  open: boolean;
  onClose: () => void;
  noiseSuppression: boolean;
  onToggleNoiseSuppression: (on: boolean) => void;
  volumes: StudioVolumeMap;
  onChangeVolume: (identity: string, volume: number) => void;
  remoteTargets: RemoteVolumeTarget[];
}

/**
 * Painel de áudio/vídeo compartilhado entre Diretor e convidado: troca de
 * câmera/mic/saída de áudio (via `room.switchActiveDevice`, por baixo do
 * `useMediaDeviceSelect`), redução de ruído (constraints nativas do
 * navegador) e volume de monitoramento local por participante.
 */
export function StudioMediaSettings({
  open,
  onClose,
  noiseSuppression,
  onToggleNoiseSuppression,
  volumes,
  onChangeVolume,
  remoteTargets,
}: StudioMediaSettingsProps) {
  const room = useRoomContext();
  const camera = useMediaDeviceSelect({ kind: "videoinput", room });
  const mic = useMediaDeviceSelect({ kind: "audioinput", room });
  const speaker = useMediaDeviceSelect({ kind: "audiooutput", room });
  const [supportsOutputSelect] = useState(
    () => typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-100">
            Configurações de áudio e vídeo
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <Camera className="h-3.5 w-3.5" /> Câmera
            </label>
            <select
              value={camera.activeDeviceId}
              onChange={(e) => camera.setActiveMediaDevice(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-100"
            >
              {camera.devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Câmera"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <Mic className="h-3.5 w-3.5" /> Microfone
            </label>
            <select
              value={mic.activeDeviceId}
              onChange={(e) => mic.setActiveMediaDevice(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-100"
            >
              {mic.devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microfone"}
                </option>
              ))}
            </select>
          </div>

          {supportsOutputSelect && speaker.devices.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                <Volume2 className="h-3.5 w-3.5" /> Saída de áudio
              </label>
              <select
                value={speaker.activeDeviceId}
                onChange={(e) => speaker.setActiveMediaDevice(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-100"
              >
                {speaker.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Alto-falante"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <Wind className="h-3.5 w-3.5" /> Redução de ruído
            </span>
            <input
              type="checkbox"
              checked={noiseSuppression}
              onChange={(e) => onToggleNoiseSuppression(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>

          {remoteTargets.length > 0 && (
            <div className="space-y-2.5 border-t border-neutral-800 pt-3">
              <p className="text-xs font-semibold text-neutral-300">
                Volume (só pra você — não muda o que vai ao ar)
              </p>
              {remoteTargets.map((t) => (
                <div key={t.identity} className="flex items-center gap-2.5">
                  <span className="w-24 shrink-0 truncate text-[11px] text-neutral-400">
                    {t.name}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={volumes[t.identity] ?? 1}
                    onChange={(e) => onChangeVolume(t.identity, Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
