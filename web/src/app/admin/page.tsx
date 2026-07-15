import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { LiveEvent } from "@/lib/types";
import { EVENT_STATUS_LABELS, PROVIDER_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: events }, { data: profile }] = await Promise.all([
    supabase.from("events").select("*").order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user?.id ?? "")
      .single(),
  ]);
  const isAdmin = profile?.is_platform_admin ?? false;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Eventos</h1>
        {isAdmin && (
          <Link
            href="/admin/eventos/novo"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            + Novo evento
          </Link>
        )}
      </div>

      {!events || events.length === 0 ? (
        <p className="text-neutral-400">Nenhum evento criado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Fonte</th>
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(events as LiveEvent[]).map((event) => (
                <tr key={event.id} className="border-t border-neutral-800">
                  <td className="px-4 py-3">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-neutral-500">/e/{event.slug}</p>
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
                  <td className="px-4 py-3 text-neutral-300">
                    {PROVIDER_LABELS[event.stream_provider]}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {event.starts_at
                      ? new Date(event.starts_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-sky-400">
                      <Link
                        href={`/admin/eventos/${event.id}/live`}
                        className="font-semibold hover:underline"
                      >
                        🎛 Diretor
                      </Link>
                      {isAdmin && (
                        <Link
                          href={`/admin/eventos/${event.id}`}
                          className="hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                      <Link
                        href={`/admin/eventos/${event.id}/inscricoes`}
                        className="hover:underline"
                      >
                        Inscrições
                      </Link>
                      <Link
                        href={`/admin/eventos/${event.id}/quiz`}
                        className="hover:underline"
                      >
                        Quiz
                      </Link>
                      <Link
                        href={`/admin/eventos/${event.id}/relatorio`}
                        className="hover:underline"
                      >
                        Relatório
                      </Link>
                      <Link
                        href={`/e/${event.slug}`}
                        className="text-neutral-400 hover:underline"
                      >
                        Ver
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
