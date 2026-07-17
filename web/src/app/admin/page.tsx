import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import { FOLDER_VISIBILITY_LABELS } from "@/lib/types";
import { NewClientButton } from "@/components/admin/NewClientButton";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
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

  // RLS já limita: admin geral vê todos; membro vê os clientes dele
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
  const list = (clients as Client[]) ?? [];

  // Colaborador/admin de um único cliente entra direto nele
  if (!isAdmin && list.length === 1) {
    redirect(`/admin/clientes/${list[0].id}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Clientes</h1>
        {isAdmin && <NewClientButton />}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center">
          <p className="text-neutral-400">
            {isAdmin
              ? "Nenhum cliente ainda. Crie o primeiro para começar."
              : "Você ainda não faz parte de nenhum cliente."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((client) => (
            <Link
              key={client.id}
              href={`/admin/clientes/${client.id}`}
              className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 transition hover:border-neutral-600"
            >
              <div className="mb-3 flex items-center gap-3">
                {client.brand_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={client.brand_logo_url}
                    alt=""
                    className="h-8 w-8 rounded object-contain"
                  />
                ) : (
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white"
                    style={{ background: client.brand_color }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <h2 className="font-semibold">{client.name}</h2>
              </div>
              <p className="text-xs text-neutral-500">
                /{client.slug} · {FOLDER_VISIBILITY_LABELS[client.folder_visibility]}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
