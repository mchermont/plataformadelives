import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LiveEvent, Profile, PublicClient } from "@/lib/types";
import { EventRoom } from "@/components/event/EventRoom";

export const dynamic = "force-dynamic";

// Sala do evento na URL canônica /cliente/evento
export default async function ClientEventPage({
  params,
}: {
  params: Promise<{ clientSlug: string; eventSlug: string }>;
}) {
  const { clientSlug, eventSlug } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .rpc("get_public_client", { p_slug: clientSlug })
    .maybeSingle<PublicClient>();
  if (!client) notFound();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", eventSlug)
    .eq("client_id", client.id)
    .single<LiveEvent>();
  if (!event) notFound();

  const basePath = `/${clientSlug}/${eventSlug}`;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${basePath}/entrar`);

  // is_approved_participant cobre inscrição aprovada E a base do cliente
  // (accept_client_base); client_members cobre a equipe do cliente.
  const [{ data: profile }, { data: isApproved }, { data: membership }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
      supabase.rpc("is_approved_participant", { p_event_id: event.id }),
      supabase
        .from("client_members")
        .select("user_id")
        .eq("client_id", client.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const isStaff =
    (profile?.is_platform_admin || profile?.is_moderator || Boolean(membership)) ??
    false;

  if (!isStaff && !isApproved) {
    redirect(`${basePath}/entrar`);
  }

  return (
    <EventRoom
      initialEvent={event}
      userId={user.id}
      userName={profile?.full_name || user.email || "Participante"}
      isAdmin={isStaff}
    />
  );
}
