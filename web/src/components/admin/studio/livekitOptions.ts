import { VideoPresets, type RoomOptions } from "livekit-client";

/**
 * Config compartilhada de todo mundo que PUBLICA vídeo no Estúdio
 * (Diretor, convidado, intérprete). Testado com 7-8 abas na mesma máquina
 * (auto-teste, não representa uso real) mostrou atraso crescente no vídeo
 * — sintoma clássico de fila de codificação sem CPU suficiente, não de
 * rede (servidor já confirmado em São Paulo, RTT baixo). Captura em 720p
 * + simulcast padrão (3 camadas) multiplicava o custo de codificação por
 * participante; aqui reduz a resolução de captura e o número de camadas,
 * mantendo o simulcast ligado (funciona junto com o `adaptiveStream` já
 * ativo, deixando quem só vê uma miniatura pequena puxar a camada leve
 * automaticamente).
 */
export const STUDIO_LIVEKIT_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h540.resolution,
  },
  publishDefaults: {
    videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h180],
  },
};
