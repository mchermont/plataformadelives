import { Palette, Radio, Sparkles } from "lucide-react";
import Reveal from "./Reveal";

const STEPS = [
  {
    icon: Palette,
    title: "Configura com a sua marca",
    description:
      "Logo, cor e página do seu cliente. Escolhe quais interações entram: quiz, enquete, nuvem de palavras, Q&A, sorteio, fotos. Sem pressa, sem código.",
  },
  {
    icon: Radio,
    title: "Transmite ao vivo",
    description:
      "YouTube ou Vimeo direto na sala, sem controles ou logo de terceiros. Sua equipe opera tudo de um painel só, feito pra decidir rápido sob pressão real.",
  },
  {
    icon: Sparkles,
    title: "Público participa de verdade",
    description:
      "Quem assiste reage, responde, pergunta e concorre — no celular, sem instalar nada. Você acompanha tudo em tempo real e exibe no telão.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t border-[var(--gl-border)] bg-[var(--gl-surface)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-xl">
          <h2
            className="text-[clamp(1.875rem,2.5vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em] text-[var(--gl-ink)]"
            style={{ textWrap: "balance" }}
          >
            Da configuração ao aplauso, em três passos
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 120} as="li">
              <span className="text-sm font-bold text-[var(--gl-brand-text)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <step.icon
                className="mt-4 h-8 w-8 text-[var(--gl-ink)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <h3 className="mt-4 text-lg font-bold text-[var(--gl-ink)]">
                {step.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--gl-muted)]">
                {step.description}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
