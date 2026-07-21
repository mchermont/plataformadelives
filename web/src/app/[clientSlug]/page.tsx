import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LiveEvent, PublicClient } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_BADGES: Partial<Record<LiveEvent["status"], { label: string; className: string }>> = {
  live: { label: "AO VIVO", className: "bg-red-600 text-white" },
  scheduled: { label: "Em breve", className: "bg-white/90 text-neutral-600 backdrop-blur-sm" },
  ended: { label: "Encerrado", className: "bg-white/90 text-neutral-500 backdrop-blur-sm" },
  ondemand: { label: "Disponível on demand", className: "bg-sky-600 text-white" },
};

// Página pública do cliente: lista os eventos marcados como "listar na página".
export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .rpc("get_public_client", { p_slug: clientSlug })
    .maybeSingle<PublicClient>();
  if (!client) notFound();

  if (!client.can_view_folder) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center bg-white px-4 text-center text-neutral-900"
        style={{ "--brand": client.brand_color } as React.CSSProperties}
      >
        {client.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client.brand_logo_url} alt={client.name} className="mb-6 h-20 object-contain" />
        ) : (
          <h1 className="mb-1 text-2xl font-bold tracking-tight">{client.name}</h1>
        )}
        <p className="mt-3 max-w-sm text-sm text-neutral-600">
          Esta página é restrita. Se você já participou de um evento, entre com
          a sua conta; senão, use o link direto enviado pelo organizador.
        </p>
        <Link
          href={`/login?next=/${client.slug}`}
          className="mt-6 rounded-lg bg-[var(--brand,#0284c7)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Entrar com minha conta
        </Link>
      </div>
    );
  }

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("client_id", client.id)
    .eq("listed_on_client_page", true)
    .neq("status", "draft")
    .order("starts_at", { ascending: false, nullsFirst: false });

  const list = (events as LiveEvent[]) ?? [];
  const hasBg = Boolean(client.bg_image_url || client.bg_image_mobile_url);

  return (
    <div
      className="min-h-dvh bg-white text-neutral-900"
      style={{ "--brand": client.brand_color } as React.CSSProperties}
    >
      {hasBg && (
        <div className="relative h-56 w-full overflow-hidden sm:h-72">
          {client.bg_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.bg_image_url}
              alt=""
              aria-hidden
              className={`h-full w-full object-cover ${
                client.bg_image_mobile_url ? "hidden sm:block" : ""
              }`}
            />
          )}
          {client.bg_image_mobile_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.bg_image_mobile_url}
              alt=""
              aria-hidden
              className={`h-full w-full object-cover ${
                client.bg_image_url ? "sm:hidden" : ""
              }`}
            />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/10 via-white/60 to-white" />
        </div>
      )}

      <div className={`mx-auto max-w-4xl px-4 pb-16 ${hasBg ? "-mt-10" : "pt-16"}`}>
        <header className="relative mb-10 text-center">
          {client.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.brand_logo_url}
              alt={client.name}
              className="mx-auto h-24 object-contain"
            />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          )}
        </header>

        {list.length === 0 ? (
          <p className="text-center text-sm text-neutral-600">
            Nenhum evento disponível no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {list.map((event) => {
              const badge = STATUS_BADGES[event.status];
              const image = event.card_image_url || event.cover_url;
              return (
                <Link
                  key={event.id}
                  href={`/${client.slug}/${event.slug}`}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand,#0284c7)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand,#0284c7)] focus-visible:ring-offset-2"
                >
                  <div className="relative aspect-[9/5.6] w-full bg-neutral-100">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ background: `${client.brand_color}12` }}
                      >
                        <span className="px-6 text-center text-lg font-semibold text-neutral-700">
                          {event.title}
                        </span>
                      </div>
                    )}
                    {badge && (
                      <span
                        className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-semibold leading-snug">{event.title}</h2>
                    {event.starts_at && (
                      <p className="mt-1 text-sm text-neutral-600">
                        {new Date(event.starts_at).toLocaleString("pt-BR", {
                          dateStyle: "long",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
