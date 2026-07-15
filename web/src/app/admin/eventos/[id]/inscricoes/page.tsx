import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventField, LiveEvent } from "@/lib/types";
import { RegistrationList } from "@/components/admin/RegistrationList";

export const dynamic = "force-dynamic";

export default async function InscricoesPage({
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
      <h1 className="mb-1 text-xl font-bold">Inscrições</h1>
      <p className="mb-6 text-sm text-neutral-400">{event.title}</p>
      <RegistrationList eventId={event.id} fields={(fields as EventField[]) ?? []} />
    </div>
  );
}
