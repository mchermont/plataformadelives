import { ArrowRight, PlayCircle } from "lucide-react";
import { WHATSAPP_URL } from "./contact";
import { PhoneFrame } from "./DeviceFrame";

const FLOAT_EMOJI = [
  { emoji: "🔥", left: "18%", delay: "0s" },
  { emoji: "👏", left: "52%", delay: "1.1s" },
  { emoji: "❤️", left: "74%", delay: "2s" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_at_top,var(--gl-brand-soft),transparent_65%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--gl-border)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--gl-muted)]">
            Lives com gamificação, do jeito da sua marca
          </p>

          <h1
            className="mt-6 max-w-xl text-[clamp(2.25rem,4.5vw+1rem,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--gl-ink)]"
            style={{ textWrap: "balance" }}
          >
            Sua live vira um evento que o público lembra
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--gl-muted)]">
            Quiz, chat moderado, Q&amp;A com aprovação, sorteio auditável e
            reações em tempo real — tudo com a marca do seu cliente estampada,
            não a nossa. A <strong className="font-semibold text-[var(--gl-ink)]">GoLive</strong>{" "}
            é a plataforma que agências e empresas usam pra transformar
            transmissão em participação.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gl-brand)] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[var(--gl-brand)]/25 transition hover:-translate-y-0.5 hover:bg-[var(--gl-brand-strong)]"
            >
              Falar com a gente
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-[var(--gl-ink)] transition hover:text-[var(--gl-brand)]"
            >
              <PlayCircle className="h-5 w-5" />
              Ver como funciona
            </a>
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

        <div className="relative mx-auto w-full max-w-xs lg:mx-0 lg:justify-self-end">
          <div className="relative mx-auto rotate-2 transition duration-500 hover:rotate-0">
            <PhoneFrame>
              <div className="flex flex-col">
                <div className="relative aspect-[9/12] w-full bg-gradient-to-br from-[var(--gl-brand)] via-[var(--gl-quiz)] to-[var(--gl-reaction)]">
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    ao vivo
                  </span>

                  <div
                    aria-hidden
                    className="absolute inset-0 overflow-hidden"
                  >
                    {FLOAT_EMOJI.map((f) => (
                      <span
                        key={f.emoji + f.left}
                        className="gl-float absolute bottom-16 text-xl"
                        style={{ left: f.left, animationDelay: f.delay }}
                      >
                        {f.emoji}
                      </span>
                    ))}
                  </div>

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
              </div>
            </PhoneFrame>
          </div>

          <div className="absolute -left-8 bottom-10 hidden w-40 -rotate-6 rounded-xl border border-[var(--gl-border)] bg-white p-3 shadow-xl sm:block">
            <p className="text-[11px] font-semibold text-[var(--gl-ink)]">
              🎉 Ana ganhou o sorteio!
            </p>
            <p className="mt-1 text-[10px] text-[var(--gl-muted)]">
              Sorteio auditável · seed pública
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
