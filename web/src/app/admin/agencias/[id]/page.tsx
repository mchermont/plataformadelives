import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agency, Client } from "@/lib/types";
import { FOLDER_VISIBILITY_LABELS } from "@/lib/types";
import { NewClientButton } from "@/components/admin/NewClientButton";
import { OrgTeam } from "@/components/admin/OrgTeam";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { DeleteEntityButton } from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agency } = await supabase
    .from("agencies")
    .select("*")
    .eq("id", id)
    .single<Agency>();
  if (!agency) notFound();

  const [{ data: clients }, { data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("agency_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("agency_members")
      .select("role")
      .eq("agency_id", id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user?.id ?? "")
      .single(),
  ]);

  const isAdmin = profile?.is_platform_admin ?? false;
  const isAgencyAdmin = isAdmin || membership?.role === "admin";
  const list = (clients as Client[]) ?? [];

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <Breadcrumb items={[{ label: "Agências", href: "/admin/agencias" }, { label: agency.name }]} />
        <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-300">
          Agência
        </span>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Clientes ({list.length})
          </h2>
          {isAgencyAdmin && <NewClientButton agencyId={id} />}
        </div>

        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            Nenhum cliente nesta agência ainda.
          </p>
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
                    <img src={client.brand_logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white"
                      style={{ background: client.brand_color }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <h3 className="font-semibold">{client.name}</h3>
                </div>
                <p className="text-xs text-neutral-500">
                  /{client.slug} · {FOLDER_VISIBILITY_LABELS[client.folder_visibility]}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isAgencyAdmin && (
        <OrgTeam
          kind="agency"
          orgId={id}
          currentUserId={user!.id}
          title="Equipe da agência"
          description="Administradores da agência gerenciam todos os clientes dela e a equipe. Colaboradores recebem funções por evento."
        />
      )}

      {isAdmin && (
        <section className="rounded-xl border border-red-900/50 bg-red-950/10 p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-400">
            Zona de risco
          </h2>
          <p className="mb-4 text-xs text-neutral-500">
            Exclui a agência permanentemente. Só é possível se não houver
            nenhum cliente vinculado a ela.
          </p>
          <DeleteEntityButton
            table="agencies"
            id={agency.id}
            confirmMessage={`Excluir a agência "${agency.name}"? Essa ação não pode ser desfeita.`}
            redirectTo="/admin/agencias"
          />
        </section>
      )}
    </div>
  );
}
