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

  // Também é "equipe" quem pertence a algum cliente ou agência
  const [{ count: clientCount }, { count: agencyCount }] = await Promise.all([
    supabase
      .from("client_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("agency_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  const isClientMember = (clientCount ?? 0) > 0;
  const isAgencyMember = (agencyCount ?? 0) > 0;

  const isStaff =
    isAdmin || (profile?.is_moderator ?? false) || isClientMember || isAgencyMember;
  if (!isStaff) redirect("/");

  const navItems = [
    { label: "Clientes", href: "/admin" },
    ...(isAdmin || isAgencyMember ? [{ label: "Agências", href: "/admin/agencias" }] : []),
    ...(isAdmin ? [{ label: "Equipe da plataforma", href: "/admin/equipe" }] : []),
  ];

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border-c bg-surface/40 sm:flex">
        <div className="border-b border-border-c px-5 py-4">
          <Link href="/admin" className="font-semibold tracking-tight text-ink">
            Plataforma de Lives
          </Link>
          <p className="mt-0.5 text-xs text-muted">Painel</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border-c p-3 text-sm text-muted">
          <p className="truncate px-3">{profile?.full_name || user.email}</p>
          {isAdmin && (
            <span className="ml-3 mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
              Admin
            </span>
          )}
          <div className="px-3 pt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* nav compacta no mobile (sidebar só aparece em sm+) */}
        <header className="flex items-center justify-between border-b border-border-c px-4 py-3 sm:hidden">
          <Link href="/admin" className="font-semibold tracking-tight text-ink">
            Plataforma de Lives
          </Link>
          <SignOutButton />
        </header>
        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
