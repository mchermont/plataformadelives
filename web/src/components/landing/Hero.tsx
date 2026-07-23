import Link from "next/link";
import { ArrowRight, PlayCircle, Users } from "lucide-react";
import { WHATSAPP_URL } from "./contact";
import { PhoneFrame } from "./DeviceFrame";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-16 sm:pb-32 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_at_top,var(--gl-brand-soft),transparent_65%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--gl-border)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--gl-muted)]">
            Transmita ao vivo. Engaje de verdade.
          </p>

          <h1
            className="mt-6 max-w-xl text-[clamp(2.25rem,4.5vw+1rem,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--gl-ink)]"
            style={{ textWrap: "balance" }}
          >
            A plataforma para quem quer participação, não só audiência.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--gl-muted)]">
            A <strong className="font-semibold text-[var(--gl-ink)]">GoLive</strong>{" "}entrega
            na sua live Quiz ao vivo, Q&amp;A e chat moderado, sorteios
            auditáveis, reações e muito mais — tudo com a sua identidade visual
            e sem complicação técnica.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gl-brand)] px-7 py-3.5 text-base font-semibold text-[var(--gl-ink)] shadow-lg shadow-[var(--gl-brand)]/25 transition hover:-translate-y-0.5 hover:bg-[var(--gl-brand-strong)]"
            >
              Falar com a gente
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-[var(--gl-ink)] transition hover:text-[var(--gl-brand-text)]"
            >
              <PlayCircle className="h-5 w-5" />
              Testar agora, de graça
            </Link>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--gl-border)] pt-6 sm:grid-cols-4">
            {[
              { label: "Quiz", color: "var(--gl-quiz)" },
              { label: "Chat & Q&A", color: "var(--gl-chat)" },
              { label: "Sorteios", color: "var(--gl-raffle)" },
              { label: "Reações", color: "var(--gl-reaction)" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: item.color }}
                  aria-hidden
                />
                <dt className="text-sm font-medium text-[var(--gl-muted)]">
                  {item.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="mx-auto w-full max-w-xs lg:mx-0 lg:justify-self-end">
          <div className="relative mx-auto rotate-2 transition duration-500 hover:rotate-0">
            <PhoneFrame>
              <div className="relative aspect-[9/16] w-full bg-[oklch(0.16_0.012_265)]">
                <div
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
                    <PlayCircle className="h-7 w-7 text-white/70" strokeWidth={1.5} />
                  </span>
                </div>

                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--gl-reaction)] opacity-75" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--gl-reaction)]" />
                  </span>
                  ao vivo
                </span>

                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                  <Users className="h-3 w-3" aria-hidden />
                  <span className="tabular-nums">312</span>
                </span>

                <div className="absolute inset-x-3 bottom-3 rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-[var(--gl-ink)]">
                    Qual dessas ativações você mais curte?
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <div className="relative h-6 overflow-hidden rounded-md bg-[var(--gl-quiz-soft)]">
                      <div
                        className="h-full rounded-md bg-[var(--gl-quiz)]"
                        style={{ width: "64%" }}
                      />
                      <span className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-semibold text-[var(--gl-ink)]">
                        <span>Sorteio</span>
                        <span>64%</span>
                      </span>
                    </div>
                    <div className="relative h-6 overflow-hidden rounded-md bg-[var(--gl-chat-soft)]">
                      <div
                        className="h-full rounded-md bg-[var(--gl-chat)]"
                        style={{ width: "36%" }}
                      />
                      <span className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-semibold text-[var(--gl-ink)]">
                        <span>Q&amp;A</span>
                        <span>36%</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
