import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventField, LiveEvent, Profile, Registration } from "@/lib/types";
import { EntrarFlow } from "./EntrarFlow";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
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
      redirect(`/e/${slug}`);
    }
  }

  return (
    <EntrarFlow
      event={event}
      fields={(fields as EventField[]) ?? []}
      user={user ? { id: user.id, email: user.email ?? "" } : null}
      profile={profile}
      registration={registration}
    />
  );
}
