import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventField } from "@/lib/types";
import { getEventChain } from "@/lib/admin/chains";
import { ReportView } from "@/components/admin/ReportView";

export const dynamic = "force-dynamic";

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ event }, { data: fields }] = await Promise.all([
    getEventChain(id),
    supabase
      .from("event_fields")
      .select("*")
      .eq("event_id", id)
      .order("position", { ascending: true }),
  ]);
  if (!event) notFound();

  return <ReportView event={event} fields={(fields as EventField[]) ?? []} />;
}
