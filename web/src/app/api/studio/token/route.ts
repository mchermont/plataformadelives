import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventParam = searchParams.get("eventId") || searchParams.get("eventSlug");
    const identity = searchParams.get("identity");
    const name = searchParams.get("name") || identity || "Convidado";
    const isDirector = searchParams.get("isDirector") === "true";

    if (!eventParam || !identity) {
      return NextResponse.json(
        { error: "eventId/eventSlug e identity são obrigatórios" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Busca o evento pelo id (UUID) ou pelo slug para garantir que Diretor e Convidado caiam na MESMA sala
    let realEventId = eventParam;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventParam);

    if (!isUuid) {
      const { data: eventData } = await supabase
        .from("events")
        .select("id")
        .eq("slug", eventParam)
        .single();

      if (eventData?.id) {
        realEventId = eventData.id;
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let canPublish = true;
    let canSubscribe = true;

    if (isDirector && !user) {
      return NextResponse.json(
        { error: "Não autorizado para controlar o estúdio" },
        { status: 401 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "secretsecretsecretsecretsecretsecretsecretsecret";

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: "8h",
    });

    const roomName = `studio-${realEventId}`;

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
