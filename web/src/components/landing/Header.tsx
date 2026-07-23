"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { WHATSAPP_URL } from "./contact";

const NAV_LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#agencias", label: "Para quem é" },
  { href: "#faq", label: "Perguntas" },
];

export default function Header({
  authHref,
  authLabel,
}: {
  authHref: string | null;
  authLabel: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--gl-border)] bg-[var(--gl-bg)]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-horizontal.png"
            alt="GoLive"
            className="h-10 w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--gl-muted)] transition hover:text-[var(--gl-ink)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {authHref && authLabel ? (
            <Link
              href={authHref}
              className="text-sm font-medium text-[var(--gl-muted)] transition hover:text-[var(--gl-ink)]"
            >
              {authLabel}
            </Link>
          ) : null}
          <Link
            href="/demo"
            className="text-sm font-medium text-[var(--gl-ink)] transition hover:text-[var(--gl-brand-text)]"
          >
            Teste agora
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[var(--gl-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--gl-ink)] shadow-sm shadow-[var(--gl-brand)]/20 transition hover:bg-[var(--gl-brand-strong)]"
          >
            Falar com a gente
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg text-[var(--gl-ink)] md:hidden"
          aria-expanded={open}
          aria-controls="gl-mobile-nav"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav
          id="gl-mobile-nav"
          className="border-t border-[var(--gl-border)] bg-[var(--gl-bg)] px-4 py-4 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--gl-ink)] hover:bg-[var(--gl-surface)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
            {authHref && authLabel ? (
              <li>
                <Link
                  href={authHref}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--gl-ink)] hover:bg-[var(--gl-surface)]"
                >
                  {authLabel}
                </Link>
              </li>
            ) : null}
            <li>
              <Link
                href="/demo"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--gl-ink)] hover:bg-[var(--gl-surface)]"
              >
                Teste agora
              </Link>
            </li>
          </ul>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded-full bg-[var(--gl-brand)] px-5 py-3 text-center text-sm font-semibold text-[var(--gl-ink)]"
          >
            Falar com a gente
          </a>
        </nav>
      )}
    </header>
  );
}
