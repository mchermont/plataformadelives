"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function tabsFor(eventId: string) {
  return [
    { label: "Configuração", href: `/admin/eventos/${eventId}` },
    { label: "Ao vivo", href: `/admin/eventos/${eventId}/live` },
    { label: "Inscrições", href: `/admin/eventos/${eventId}/inscricoes` },
    { label: "Relatório", href: `/admin/eventos/${eventId}/relatorio` },
  ];
}

/** Abas de seção do evento — mesma navegação em qualquer subpágina. */
export function EventSectionNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const tabs = tabsFor(eventId);

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border-c">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
