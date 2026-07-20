import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Agency, Client, LiveEvent } from "@/lib/types";

/** Cliente + agência (se houver). Memoizado por request — layout e página
 * do mesmo cliente reaproveitam a mesma busca. */
export const getClientChain = cache(async (id: string) => {
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single<Client>();
  if (!client) return { client: null, agency: null };

  let agency: Agency | null = null;
  if (client.agency_id) {
    const { data } = await supabase
      .from("agencies")
      .select("*")
      .eq("id", client.agency_id)
      .single<Agency>();
    agency = data;
  }
  return { client, agency };
});

/** Evento + cliente + agência (se houver). Memoizado por request — layout
 * e as 4 subpáginas do evento reaproveitam a mesma busca. */
export const getEventChain = cache(async (id: string) => {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single<LiveEvent>();
  if (!event) return { event: null, client: null, agency: null };

  let client: Client | null = null;
  let agency: Agency | null = null;
  if (event.client_id) {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("id", event.client_id)
      .single<Client>();
    client = data;
    if (client?.agency_id) {
      const { data: agencyData } = await supabase
        .from("agencies")
        .select("*")
        .eq("id", client.agency_id)
        .single<Agency>();
      agency = agencyData;
    }
  }
  return { event, client, agency };
});
