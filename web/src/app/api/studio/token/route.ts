import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const identity = searchParams.get("identity");
    const name = searchParams.get("name") || identity || "Convidado";
    const isDirector = searchParams.get("isDirector") === "true";

    if (!eventId || !identity) {
      return NextResponse.json(
        { error: "eventId e identity são obrigatórios" },
        { status: 400 }
      );
    }

    // Valida usuário no Supabase se for diretor
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let canPublish = true;
    let canSubscribe = true;

    if (isDirector) {
      if (!user) {
        return NextResponse.json(
          { error: "Não autorizado para controlar o estúdio" },
          { status: 401 }
        );
      }
    }

    const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "secretsecretsecretsecretsecretsecretsecretsecret";

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: "8h",
    });

    const roomName = `studio-${eventId}`;

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData: true,
      roomAdmin: isDirector,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      roomName,
      serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
