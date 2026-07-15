import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/admin/EventForm";

export default async function NovoEventoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Novo evento</h1>
      <EventForm userId={user.id} />
    </div>
  );
}
