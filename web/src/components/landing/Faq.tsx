import { ChevronDown } from "lucide-react";
import Reveal from "./Reveal";

const FAQS = [
  {
    q: "Quanto custa?",
    a: "Sob consulta — a estrutura muda conforme número de eventos, participantes esperados e quais recursos entram. Fala com a gente no WhatsApp e a gente monta uma proposta pro seu caso.",
  },
  {
    q: "O público precisa instalar algum aplicativo?",
    a: "Não. Tudo roda no navegador do celular ou computador, direto pelo link do evento. Sem app, sem cadastro em loja.",
  },
  {
    q: "Funciona pra qualquer tipo de evento?",
    a: "Sim — convenções corporativas, lançamentos, treinamentos, eventos internos e lives comerciais. Você escolhe quais interações fazem sentido pra cada um.",
  },
  {
    q: "As perguntas e comentários aparecem sem revisão?",
    a: "Não. Toda pergunta de Q&A nasce pendente e só fica pública depois de aprovada pela sua equipe; o chat é pré-moderado. Nada vai ao ar sem alguém revisar.",
  },
  {
    q: "O sorteio é confiável?",
    a: "Cada sorteio roda por uma rotina com seed e hash determinísticos, sem caminho pra editar o resultado depois — o log é auditável e exportável em CSV.",
  },
  {
    q: "Dá pra usar minha própria transmissão do YouTube ou Vimeo?",
    a: "Sim. O player é white-label: sem logo ou controle de terceiros aparecendo, com a cara do seu evento.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="border-t border-[var(--gl-border)] bg-[var(--gl-surface)] py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2
            className="text-[clamp(1.875rem,2.5vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em] text-[var(--gl-ink)]"
            style={{ textWrap: "balance" }}
          >
            Perguntas frequentes
          </h2>
        </Reveal>

        <div className="mt-12 divide-y divide-[var(--gl-border)] border-y border-[var(--gl-border)]">
          {FAQS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-semibold text-[var(--gl-ink)] marker:content-none">
                {item.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-[var(--gl-muted)] transition-transform duration-300 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-[var(--gl-muted)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
