import { TelaoView } from "./TelaoView";

export const dynamic = "force-dynamic";

/**
 * Telão para OBS/vMix (browser source) ou projeção em evento híbrido.
 * Rota pública sem login (o OBS não tem sessão): o UUID do evento na URL
 * funciona como token, e o RPC get_screen_state só expõe agregados anônimos.
 */
export default async function TelaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bg?: string }>;
}) {
  const { id } = await params;
  const { bg } = await searchParams;
  return <TelaoView eventId={id} bg={bg ?? "dark"} />;
}
