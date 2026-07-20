import { notFound } from "next/navigation";
import { getEventChain } from "@/lib/admin/chains";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { EventSectionNav } from "@/components/admin/EventSectionNav";

export default async function EventoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, client, agency } = await getEventChain(id);
  if (!event) notFound();

  return (
    <div>
      <Breadcrumb
        items={[
          ...(agency ? [{ label: agency.name, href: `/admin/agencias/${agency.id}` }] : []),
          client
            ? { label: client.name, href: `/admin/clientes/${client.id}` }
            : { label: "Eventos", href: "/admin" },
          { label: event.title },
        ]}
      />
      <EventSectionNav eventId={event.id} />
      {children}
    </div>
  );
}
