import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

function cleanEnv(val?: string): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    // getSession() lê a sessão do cookie sem round-trip até o servidor de
    // Auth (getUser() faz essa chamada de rede toda vez) — este endpoint é
    // acionado a cada clique de subir/descer alguém do palco, e cada
    // milissegundo aqui é delay percebido pelo Diretor em tempo real.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { eventId, participantIdentity, isOnStage } = body;

    if (!eventId || !participantIdentity) {
      return NextResponse.json({ error: "eventId e participantIdentity são obrigatórios" }, { status: 400 });
    }

    const apiKey = cleanEnv(process.env.LIVEKIT_API_KEY);
    const apiSecret = cleanEnv(process.env.LIVEKIT_API_SECRET);
    const serverUrl = cleanEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL).replace("wss://", "https://").replace("ws://", "http://");

    if (!apiKey || !apiSecret || !serverUrl) {
      return NextResponse.json({ error: "LiveKit não configurado no servidor" }, { status: 500 });
    }

    const roomService = new RoomServiceClient(serverUrl, apiKey, apiSecret);
    const roomName = `studio-${eventId}`;

    // Atualiza o atributo isOnStage do participante remoto via LiveKit Server SDK
    await roomService.updateParticipant(roomName, participantIdentity, {
      attributes: {
        isOnStage: isOnStage ? "true" : "false",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("Erro ao atualizar stage do participante:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
