import { NextRequest, NextResponse } from "next/server";
import { EgressClient, StreamOutput, StreamProtocol } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendlyError";
import type { StudioStreamDestination } from "@/lib/types";

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

    const { eventId } = await req.json();
    if (!eventId) {
      return NextResponse.json({ error: "eventId é obrigatório" }, { status: 400 });
    }

    const { data: hasRole } = await supabase.rpc("has_event_role", {
      p_event_id: eventId,
      p_capability: "stream",
    });
    if (!hasRole) {
      return NextResponse.json({ error: "Sem permissão para transmitir neste evento" }, { status: 403 });
    }

    const { data: destinations, error: destError } = await supabase
      .from("studio_stream_destinations")
      .select("*")
      .eq("event_id", eventId)
      .eq("enabled", true);

    if (destError) {
      return NextResponse.json({ error: friendlyError(destError.message) }, { status: 500 });
    }

    const urls = ((destinations as StudioStreamDestination[]) || []).map(
      (d) => `${d.rtmp_url.replace(/\/$/, "")}/${d.stream_key}`
    );

    if (urls.length === 0) {
      return NextResponse.json({ error: "Cadastre e habilite pelo menos um destino antes de transmitir" }, { status: 400 });
    }

    const apiKey = cleanEnv(process.env.LIVEKIT_API_KEY);
    const apiSecret = cleanEnv(process.env.LIVEKIT_API_SECRET);
    const egressHost = cleanEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL)
      .replace("wss://", "https://")
      .replace("ws://", "http://");
    const siteUrl = cleanEnv(process.env.NEXT_PUBLIC_SITE_URL);

    if (!apiKey || !apiSecret || !egressHost || !siteUrl) {
      return NextResponse.json({ error: "Transmissão não configurada no servidor" }, { status: 500 });
    }

    const outputUrl = `${siteUrl}/estudio/${eventId}/output`;
    const egressClient = new EgressClient(egressHost, apiKey, apiSecret);

    const info = await egressClient.startWebEgress(
      outputUrl,
      new StreamOutput({ protocol: StreamProtocol.RTMP, urls })
    );

    await supabase
      .from("studio_rooms")
      .update({ egress_id: info.egressId, egress_status: "starting", egress_error: null })
      .eq("event_id", eventId);

    return NextResponse.json({ egressId: info.egressId, status: "starting" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("Erro ao iniciar transmissão:", message);
    return NextResponse.json({ error: friendlyError(message) }, { status: 500 });
  }
}
