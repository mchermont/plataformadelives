import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventAllowlistEntry, EventField } from "@/lib/types";
import { getEventChain } from "@/lib/admin/chains";
import { EventForm } from "@/components/admin/EventForm";
import { EventTeam } from "@/components/admin/EventTeam";
import { MaterialsManager } from "@/components/admin/MaterialsManager";

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

  const [{ event }, { data: fields }, { data: allowlist }] = await Promise.all([
    getEventChain(id),
    supabase
      .from("event_fields")
      .select("*")
      .eq("event_id", id)
      .order("position", { ascending: true }),
    supabase.from("event_allowlist").select("*").eq("event_id", id),
  ]);
  if (!event) notFound();

  return (
    <div>
      <EventForm
        event={event}
        fields={(fields as EventField[]) ?? []}
        allowlist={(allowlist as EventAllowlistEntry[]) ?? []}
        userId={user.id}
      />
      <div className="mt-10 max-w-2xl border-t border-neutral-800 pt-8">
        <MaterialsManager eventId={event.id} userId={user.id} />
      </div>
      <div className="mt-10 max-w-2xl border-t border-neutral-800 pt-8">
        <EventTeam eventId={event.id} clientId={event.client_id} />
      </div>
    </div>
  );
}
