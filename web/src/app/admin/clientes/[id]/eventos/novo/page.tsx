import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
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

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single<Client>();
  if (!client) notFound();

  return (
    <div>
      <Link
        href={`/admin/clientes/${id}`}
        className="text-sm text-neutral-500 hover:underline"
      >
        ← {client.name}
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-bold">Novo evento</h1>
      <EventForm userId={user.id} clientId={id} />
    </div>
  );
}
