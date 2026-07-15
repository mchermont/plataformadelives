import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LiveEvent, Profile, Registration } from "@/lib/types";
import { EventRoom } from "@/components/event/EventRoom";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .single<LiveEvent>();
  if (!event) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/e/${slug}/entrar`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const { data: registration } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle<Registration>();

  const isStaff =
    (profile?.is_platform_admin || profile?.is_moderator) ?? false;

  if (!isStaff && (!registration || registration.status !== "approved")) {
    redirect(`/e/${slug}/entrar`);
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
