import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LiveEvent } from "@/lib/types";
import { QuizManager } from "@/components/admin/QuizManager";

export const dynamic = "force-dynamic";

export default async function QuizAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: event }, { data: profile }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single<LiveEvent>(),
    supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user?.id ?? "")
      .single(),
  ]);
  if (!event) notFound();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Quiz</h1>
      <p className="mb-6 text-sm text-neutral-400">{event.title}</p>
      <QuizManager
        eventId={event.id}
        isAdmin={profile?.is_platform_admin ?? false}
      />
    </div>
  );
}
