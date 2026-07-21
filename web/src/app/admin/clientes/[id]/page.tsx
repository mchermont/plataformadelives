import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LiveEvent } from "@/lib/types";
import { EVENT_STATUS_LABELS } from "@/lib/types";
import { getClientChain } from "@/lib/admin/chains";
import { OrgTeam } from "@/components/admin/OrgTeam";
import { ClientForm } from "@/components/admin/ClientForm";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { DeleteEntityButton } from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { client, agency } = await getClientChain(id);
  if (!client) notFound();

  const [{ data: events }, { data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_members")
      .select("role")
      .eq("client_id", id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user?.id ?? "")
      .single(),
  ]);

  const isAdmin = profile?.is_platform_admin ?? false;
  const isClientAdmin = isAdmin || membership?.role === "admin";
  const list = (events as LiveEvent[]) ?? [];

  // Excluir cliente é privilégio de quem está acima dele na hierarquia
  // (admin geral ou admin da agência-mãe) — admin do próprio cliente não
  // pode se autoexcluir (mesma regra da RLS "clients_delete").
  let isAgencyAdmin = false;
  if (agency) {
    const { data: agencyMembership } = await supabase
      .from("agency_members")
      .select("role")
      .eq("agency_id", agency.id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle();
    isAgencyAdmin = agencyMembership?.role === "admin";
  }
  const canDeleteClient = isAdmin || isAgencyAdmin;

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <Breadcrumb
          items={
            agency
              ? [
                  { label: "Agências", href: "/admin/agencias" },
                  { label: agency.name, href: `/admin/agencias/${agency.id}` },
                  { label: client.name },
                ]
              : [{ label: "Clientes", href: "/admin" }, { label: client.name }]
          }
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Eventos ({list.length})
          </h2>
          {isClientAdmin && (
            <Link
              href={`/admin/clientes/${id}/eventos/novo`}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              + Novo evento
            </Link>
          )}
        </div>

        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 p-10 text-center text-neutral-400">
            Nenhum evento criado para este cliente ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-left text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((event) => (
                  <tr key={event.id} className="border-t border-neutral-800">
                    <td className="px-4 py-3">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-xs text-neutral-500">/{client.slug}/{event.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          event.status === "live"
                            ? "font-semibold text-red-400"
                            : "text-neutral-300"
                        }
                      >
                        {EVENT_STATUS_LABELS[event.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-sky-400">
                        <Link href={`/admin/eventos/${event.id}/live`} className="flex items-center gap-1 font-semibold hover:underline">
                          <MonitorPlay className="size-3.5" /> Sala de produção
                        </Link>
                        {isClientAdmin && (
                          <Link href={`/admin/eventos/${event.id}`} className="hover:underline">
                            Editar
                          </Link>
                        )}
                        <Link href={`/admin/eventos/${event.id}/inscricoes`} className="hover:underline">
                          Inscrições
                        </Link>
                        <Link href={`/admin/eventos/${event.id}/relatorio`} className="hover:underline">
                          Relatório
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isClientAdmin && <ClientForm client={client} />}

      {isClientAdmin && (
        <OrgTeam
          kind="client"
          orgId={id}
          currentUserId={user!.id}
          title="Equipe do cliente"
        />
      )}

      {canDeleteClient && (
        <section className="rounded-xl border border-red-900/50 bg-red-950/10 p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-400">
            Zona de risco
          </h2>
          <p className="mb-4 text-xs text-neutral-500">
            Exclui o cliente permanentemente. Só é possível se não houver
            nenhum evento vinculado a ele.
          </p>
          <DeleteEntityButton
            table="clients"
            id={client.id}
            confirmMessage={`Excluir o cliente "${client.name}"? Essa ação não pode ser desfeita.`}
            redirectTo={agency ? `/admin/agencias/${agency.id}` : "/admin"}
          />
        </section>
      )}
    </div>
  );
}
