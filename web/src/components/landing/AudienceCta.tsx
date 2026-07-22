import { ArrowRight, Briefcase, Building } from "lucide-react";
import Reveal from "./Reveal";
import { WHATSAPP_URL } from "./contact";

const AUDIENCES = [
  {
    icon: Briefcase,
    title: "Você é uma agência ou produtora",
    description:
      "Revenda a GoLive com a marca de cada cliente, gerencie vários eventos ao mesmo tempo e mostre resultado com relatório exportável — sem escrever uma linha de código.",
    color: "var(--gl-brand)",
    soft: "var(--gl-brand-soft)",
  },
  {
    icon: Building,
    title: "Você organiza o próprio evento",
    description:
      "Convenção, lançamento, treinamento ou live de fim de ano: configure em horas, com a cara da sua empresa, e deixe o público participar de verdade — não só assistir.",
    color: "var(--gl-chat)",
    soft: "var(--gl-chat-soft)",
  },
];

export default function AudienceCta() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-xl text-center">
          <h2
            className="text-[clamp(1.875rem,2.5vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em] text-[var(--gl-ink)]"
            style={{ textWrap: "balance" }}
          >
            Pra quem é a GoLive
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {AUDIENCES.map((aud, i) => (
            <Reveal key={aud.title} delay={i * 100}>
              <div className="flex h-full flex-col rounded-2xl border border-[var(--gl-border)] bg-white p-8">
                <span
                  className="grid h-12 w-12 place-items-center rounded-xl"
                  style={{ background: aud.soft }}
                >
                  <aud.icon className="h-6 w-6" style={{ color: aud.color }} />
                </span>
                <h3 className="mt-5 text-xl font-bold text-[var(--gl-ink)]">
                  {aud.title}
                </h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[var(--gl-muted)]">
                  {aud.description}
                </p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: aud.color }}
                >
                  Falar com a gente
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
