import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, LiveEvent } from "@/lib/types";
import { EVENT_STATUS_LABELS } from "@/lib/types";
import { OrgTeam } from "@/components/admin/OrgTeam";
import { ClientForm } from "@/components/admin/ClientForm";

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

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single<Client>();
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

  return (
    <div className="space-y-10">
      <div>
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← Clientes
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {client.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.brand_logo_url} alt="" className="h-9 w-9 rounded object-contain" />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded font-bold text-white"
              style={{ background: client.brand_color }}
            >
              {client.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="text-xl font-bold">{client.name}</h1>
            <p className="text-xs text-neutral-500">
              Página pública: lives.propanofilmes.com.br/{client.slug}
            </p>
          </div>
        </div>
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
          <p className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
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
                        <Link href={`/admin/eventos/${event.id}/live`} className="font-semibold hover:underline">
                          🎛 Diretor
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
    </div>
  );
}
