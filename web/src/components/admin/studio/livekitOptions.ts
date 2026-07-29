import { VideoPresets, type RoomOptions } from "livekit-client";

/**
 * Config compartilhada de todo mundo que PUBLICA vídeo no Estúdio
 * (Diretor, convidado, intérprete). Testado com 7-8 abas na mesma máquina
 * (auto-teste, não representa uso real) mostrou atraso crescente no vídeo
 * com captura em 720p — sintoma clássico de fila de codificação sem CPU
 * suficiente, não de rede (servidor já confirmado em São Paulo, RTT
 * baixo) — por isso foi reduzido pra 540p numa rodada anterior. Voltou
 * pra 720p (26/07/2026, decisão do Marcelo) porque isso agora alimenta
 * transmissão de verdade pro YouTube/RTMP via Egress, e a qualidade da
 * live importa mais que o teste local com várias abas na mesma máquina
 * — quem sentir a CPU pesar num teste local pode reduzir de novo depois.
 * `adaptiveStream` continua ligado (quem só vê uma miniatura pequena
 * puxa a camada leve automaticamente).
 */
export const STUDIO_LIVEKIT_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },
  // Sem isso, o cancelador de eco só entrava quando alguém abria as
  // Configurações e mexia manualmente no toggle de ruído — quem entra e
  // nunca abre esse painel (a maioria) ficava sem eco cancelado desde o
  // primeiro segundo, e quem está sem fone realimenta o próprio mic pela
  // caixa de som. Agora já vem ligado na primeira captura.
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    videoSimulcastLayers: [VideoPresets.h720, VideoPresets.h360, VideoPresets.h180],
  },
};
