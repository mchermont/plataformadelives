import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agency } from "@/lib/types";
import { NewAgencyButton } from "@/components/admin/NewAgencyButton";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user?.id ?? "")
    .single();
  const isAdmin = profile?.is_platform_admin ?? false;

  // RLS: admin geral vê todas; membro vê as suas
  const { data: agencies } = await supabase
    .from("agencies")
    .select("*")
    .order("name", { ascending: true });
  const list = (agencies as Agency[]) ?? [];

  if (!isAdmin && list.length === 0) redirect("/admin");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Agências / Produtoras</h1>
        {isAdmin && <NewAgencyButton />}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center">
          <p className="text-neutral-400">
            Nenhuma agência ainda. Crie uma para agrupar vários clientes sob um
            mesmo gestor.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((agency) => (
            <Link
              key={agency.id}
              href={`/admin/agencias/${agency.id}`}
              className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 transition hover:border-neutral-600"
            >
              <span className="mb-2 inline-block rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-300">
                Agência
              </span>
              <h2 className="font-semibold">{agency.name}</h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
