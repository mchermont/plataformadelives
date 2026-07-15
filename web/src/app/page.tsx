import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Home institucional: eventos são privados e acessados apenas pelo link direto.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin, is_moderator")
      .eq("id", user.id)
      .single();
    isStaff = (profile?.is_platform_admin || profile?.is_moderator) ?? false;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Plataforma de Lives
        </h1>
        {isStaff ? (
          <Link
            href="/admin"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            Painel
          </Link>
        ) : !user ? (
          <Link
            href="/login"
            className="text-sm text-neutral-400 hover:text-white"
          >
            Entrar
          </Link>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-sky-400">
          Transmissões ao vivo privadas
        </p>
        <h2 className="max-w-xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          Lives com acesso controlado, chat e quiz em tempo real
        </h2>
        <p className="mt-4 max-w-md text-neutral-400">
          O acesso a cada evento é feito pelo link exclusivo enviado pelo
          organizador.
        </p>
      </main>
    </div>
  );
}
