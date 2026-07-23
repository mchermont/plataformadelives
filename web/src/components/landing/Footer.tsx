import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { WHATSAPP_URL } from "./contact";

export default function Footer({
  authHref,
  authLabel,
}: {
  authHref: string | null;
  authLabel: string | null;
}) {
  return (
    <>
      <section className="bg-[var(--gl-brand)] py-28 text-[var(--gl-ink)] sm:py-32">
        <Reveal className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2
            className="text-[clamp(1.875rem,3vw+1rem,3rem)] font-extrabold tracking-[-0.03em]"
            style={{ textWrap: "balance" }}
          >
            Vamos colocar seu próximo evento pra interagir?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[var(--gl-ink)]/75">
            Conta pra gente o formato do seu evento e a gente te mostra a
            plataforma funcionando.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[var(--gl-brand-text)] transition hover:-translate-y-0.5"
          >
            Falar com a gente no WhatsApp
            <ArrowRight className="h-4 w-4" />
          </a>
        </Reveal>
      </section>

      <footer className="bg-[var(--gl-ink)] py-10 text-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm sm:flex-row sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="h-6 w-6 rounded-md" />
            <span className="font-bold">GoLive</span>
          </div>

          <p>© {new Date().getFullYear()} GoLive. Todos os direitos reservados.</p>

          {authHref && authLabel ? (
            <Link href={authHref} className="font-medium text-white/80 hover:text-white">
              {authLabel}
            </Link>
          ) : (
            <span />
          )}
        </div>
      </footer>
    </>
  );
}
