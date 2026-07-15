import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventField, LiveEvent } from "@/lib/types";
import { EventForm } from "@/components/admin/EventForm";

export const dynamic = "force-dynamic";

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

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
      <h1 className="mb-6 text-xl font-bold">Editar evento</h1>
      <EventForm event={event} fields={(fields as EventField[]) ?? []} userId={user.id} />
    </div>
  );
}
