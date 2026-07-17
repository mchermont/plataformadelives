import { redirect } from "next/navigation";

// Eventos agora nascem dentro de um cliente: /admin/clientes/[id]/eventos/novo
export default function LegacyNovoEventoPage() {
  redirect("/admin");
}
