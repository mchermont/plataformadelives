"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function tabsFor(eventId: string) {
  return [
    { label: "Configuração", href: `/admin/eventos/${eventId}` },
    { label: "Sala de produção", href: `/admin/eventos/${eventId}/live` },
    { label: "Inscrições", href: `/admin/eventos/${eventId}/inscricoes` },
    { label: "Relatório", href: `/admin/eventos/${eventId}/relatorio` },
  ];
}

/** Abas de seção do evento — mesma navegação em qualquer subpágina. */
export function EventSectionNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const tabs = tabsFor(eventId);

  return (
    <nav className="mb-6 flex gap-1 rounded-xl border border-border-c bg-surface/40 p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-accent text-ink"
                : "text-muted hover:bg-bg hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
