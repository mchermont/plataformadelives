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
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="sticky top-0 z-20 border-b border-border-c bg-surface/90 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-baseline gap-2">
            <span className="font-semibold tracking-tight text-ink">Plataforma de Lives</span>
            <span className="hidden text-xs text-muted sm:inline">Painel</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-bg hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden max-w-[10rem] truncate text-sm text-muted md:inline">
              {profile?.full_name || user.email}
            </span>
            {isAdmin && (
              <span className="hidden rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent sm:inline-block">
                Admin
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border-c px-4 py-1.5 sm:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-bg hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
