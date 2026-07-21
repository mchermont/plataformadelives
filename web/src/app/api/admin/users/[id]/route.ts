import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Exclui a conta de um usuário (auth.users + profiles em cascata — ver
 * migração 0001). Só admin de plataforma pode chamar; ninguém pode excluir
 * a própria conta por aqui. auth.users não tem RLS, então a única forma de
 * apagar de verdade é pela Admin API do Supabase, que exige a service role
 * key (nunca exposta ao browser) — daí a rota de servidor em vez de RPC.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_platform_admin) {
    return NextResponse.json(
      { error: "Você não tem permissão para fazer isso." },
      { status: 403 },
    );
  }

  if (id === user.id) {
    return NextResponse.json(
      { error: "Não é possível excluir a própria conta por aqui." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível excluir esta conta. Tente novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
