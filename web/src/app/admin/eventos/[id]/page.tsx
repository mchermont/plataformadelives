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
    <EventForm
      event={event}
      fields={(fields as EventField[]) ?? []}
      allowlist={(allowlist as EventAllowlistEntry[]) ?? []}
      userId={user.id}
      extraTabs={[
        {
          key: "materiais",
          label: "Materiais",
          content: <MaterialsManager eventId={event.id} userId={user.id} />,
        },
        {
          key: "equipe",
          label: "Equipe",
          content: <EventTeam eventId={event.id} clientId={event.client_id} />,
        },
      ]}
    />
  );
}
