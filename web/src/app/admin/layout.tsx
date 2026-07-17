import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin, is_moderator, full_name")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_platform_admin ?? false;

  // Também é "equipe" quem pertence a algum cliente (admin ou colaborador)
  const { count: membershipCount } = await supabase
    .from("client_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  const isClientMember = (membershipCount ?? 0) > 0;

  const isStaff = isAdmin || (profile?.is_moderator ?? false) || isClientMember;
  if (!isStaff) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold tracking-tight">
            Painel · Plataforma de Lives
          </Link>
          <nav className="flex gap-4 text-sm text-neutral-400">
            <Link href="/admin" className="hover:text-white">
              Clientes
            </Link>
            {isAdmin && (
              <Link href="/admin/equipe" className="hover:text-white">
                Equipe da plataforma
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>{profile?.full_name || user.email}</span>
          {isAdmin ? (
            <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs text-sky-400">
              Admin
            </span>
          ) : null}
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
