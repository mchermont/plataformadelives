import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventField, LiveEvent } from "@/lib/types";
import { ReportView } from "@/components/admin/ReportView";

export const dynamic = "force-dynamic";

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: fields }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single<LiveEvent>(),
    supabase
      .from("event_fields")
      .select("*")
      .eq("event_id", id)
      .order("position", { ascending: true }),
  ]);
  if (!event) notFound();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Relatório</h1>
      <p className="mb-6 text-sm text-neutral-400">{event.title}</p>
      <ReportView event={event} fields={(fields as EventField[]) ?? []} />
    </div>
  );
}
