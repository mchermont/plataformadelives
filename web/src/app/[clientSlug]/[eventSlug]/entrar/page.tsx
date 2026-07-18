import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  EventField,
  LiveEvent,
  Profile,
  PublicClient,
  Registration,
} from "@/lib/types";
import { EntrarFlow } from "@/components/event/EntrarFlow";

export const dynamic = "force-dynamic";

// Cadastro do evento na URL canônica /cliente/evento/entrar
export default async function ClientEventEntrarPage({
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

  const { data: fields } = await supabase
    .from("event_fields")
    .select("*")
    .eq("event_id", event.id)
    .order("position", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let registration: Registration | null = null;
  let profile: Profile | null = null;

  if (user) {
    const [{ data: reg }, { data: prof }] = await Promise.all([
      supabase
        .from("registrations")
        .select("*")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle<Registration>(),
      supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    ]);
    registration = reg;
    profile = prof;

    if (reg?.status === "approved" || prof?.is_platform_admin) {
      redirect(basePath);
    }
  }

  return (
    <EntrarFlow
      event={event}
      fields={(fields as EventField[]) ?? []}
      user={user ? { id: user.id, email: user.email ?? "" } : null}
      profile={profile}
      registration={registration}
      basePath={basePath}
    />
  );
}
