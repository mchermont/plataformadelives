import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** Trilha de navegação (Agência → Cliente → Evento). O item atual não é
 * um link; os anteriores levam um nível acima na hierarquia. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-muted" aria-hidden="true">
                /
              </span>
            )}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-muted transition hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-ink" : "text-muted"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
