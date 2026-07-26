import { NextRequest, NextResponse } from "next/server";
import { EgressClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendlyError";

function cleanEnv(val?: string): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { eventId, egressId } = await req.json();
    if (!eventId || !egressId) {
      return NextResponse.json({ error: "eventId e egressId são obrigatórios" }, { status: 400 });
    }

    const { data: hasRole } = await supabase.rpc("has_event_role", {
      p_event_id: eventId,
      p_capability: "stream",
    });
    if (!hasRole) {
      return NextResponse.json({ error: "Sem permissão para transmitir neste evento" }, { status: 403 });
    }

    const apiKey = cleanEnv(process.env.LIVEKIT_API_KEY);
    const apiSecret = cleanEnv(process.env.LIVEKIT_API_SECRET);
    const egressHost = cleanEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL)
      .replace("wss://", "https://")
      .replace("ws://", "http://");

    if (!apiKey || !apiSecret || !egressHost) {
      return NextResponse.json({ error: "Transmissão não configurada no servidor" }, { status: 500 });
    }

    const egressClient = new EgressClient(egressHost, apiKey, apiSecret);
    await egressClient.stopEgress(egressId);

    await supabase
      .from("studio_rooms")
      .update({ egress_status: "stopping" })
      .eq("event_id", eventId);

    return NextResponse.json({ status: "stopping" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("Erro ao encerrar transmissão:", message);
    return NextResponse.json({ error: friendlyError(message) }, { status: 500 });
  }
}
