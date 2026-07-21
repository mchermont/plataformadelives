import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamList } from "@/components/admin/TeamList";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user?.id ?? "")
    .single();
  if (!profile?.is_platform_admin) redirect("/admin");

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-bold">Equipe</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Moderadores podem aprovar inscrições, moderar o chat e operar o quiz ao
        vivo — mas não criam nem editam eventos. A pessoa precisa ter feito
        login na plataforma ao menos uma vez para aparecer aqui.
      </p>
      <TeamList currentUserId={user!.id} />
    </div>
  );
}
