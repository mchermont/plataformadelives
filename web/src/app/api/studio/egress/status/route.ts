import { NextRequest, NextResponse } from "next/server";
import { EgressClient, EgressStatus } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendlyError";
import type { StudioRoom } from "@/lib/types";

function cleanEnv(val?: string): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

// EGRESS_ENDING/COMPLETE/FAILED/ABORTED/LIMIT_REACHED todos encerram a
// transmissão do nosso ponto de vista — só COMPLETE/ABORTED/LIMIT_REACHED
// já terminaram de vez (viram "idle"), FAILED vira "error", ENDING ainda
// é transição (mantém "stopping").
function mapStatus(status: EgressStatus): { egress_status: StudioRoom["egress_status"] | "idle"; egress_error: string | null } {
  switch (status) {
    case EgressStatus.EGRESS_STARTING:
      return { egress_status: "starting", egress_error: null };
    case EgressStatus.EGRESS_ACTIVE:
      return { egress_status: "active", egress_error: null };
    case EgressStatus.EGRESS_ENDING:
      return { egress_status: "stopping", egress_error: null };
    case EgressStatus.EGRESS_FAILED:
      return { egress_status: "error", egress_error: "A transmissão falhou. Confira as chaves de stream dos destinos." };
    default:
      return { egress_status: "idle", egress_error: null };
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId é obrigatório" }, { status: 400 });
    }

    const { data: room } = await supabase
      .from("studio_rooms")
      .select("egress_id")
      .eq("event_id", eventId)
      .maybeSingle();

    const egressId = room?.egress_id;
    if (!egressId) {
      return NextResponse.json({ egress_status: "idle", egress_error: null });
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
    const results = await egressClient.listEgress({ egressId });
    const info = results[0];

    if (!info) {
      return NextResponse.json({ egress_status: "idle", egress_error: null });
    }

    const mapped = mapStatus(info.status);
    const egress_status = mapped.egress_status === "idle" ? null : mapped.egress_status;
    const egress_error = mapped.egress_status === "error" ? (info.error || mapped.egress_error) : null;

    await supabase
      .from("studio_rooms")
      .update({
        egress_status,
        egress_error,
        egress_id: mapped.egress_status === "idle" ? null : egressId,
      })
      .eq("event_id", eventId);

    return NextResponse.json({ egress_status, egress_error });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("Erro ao consultar status da transmissão:", message);
    return NextResponse.json({ error: friendlyError(message) }, { status: 500 });
  }
}
