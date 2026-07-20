import { notFound } from "next/navigation";
import { getClientChain } from "@/lib/admin/chains";
import { Breadcrumb } from "@/components/admin/Breadcrumb";

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client, agency } = await getClientChain(id);
  if (!client) notFound();

  return (
    <div>
      <Breadcrumb
        items={[
          ...(agency ? [{ label: agency.name, href: `/admin/agencias/${agency.id}` }] : []),
          { label: "Clientes", href: "/admin" },
          { label: client.name },
        ]}
      />
      <div className="mb-8 flex items-center gap-3">
        {client.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.brand_logo_url}
            alt=""
            className="h-9 w-9 rounded object-contain"
          />
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded font-bold text-white"
            style={{ background: client.brand_color }}
          >
            {client.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold text-ink">{client.name}</h1>
          <p className="text-xs text-muted">
            Página pública: lives.propanofilmes.com.br/{client.slug}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
