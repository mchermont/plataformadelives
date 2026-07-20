import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientChain } from "@/lib/admin/chains";
import { EventForm } from "@/components/admin/EventForm";

export const dynamic = "force-dynamic";

export default async function NovoEventoDoClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { client } = await getClientChain(id);
  if (!client) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-ink">Novo evento</h1>
      <EventForm userId={user.id} clientId={id} />
    </div>
  );
}
