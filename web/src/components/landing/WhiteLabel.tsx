import { Building2, Palette } from "lucide-react";
import Reveal from "./Reveal";
import { BrowserFrame } from "./DeviceFrame";

const EXAMPLES = [
  { name: "Cliente A", color: "oklch(0.55 0.19 250)", event: "Convenção Anual" },
  { name: "Cliente B", color: "oklch(0.58 0.18 150)", event: "Lançamento de produto" },
];

export default function WhiteLabel() {
  return (
    <section id="agencias" className="py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--gl-brand-soft)] px-3 py-1 text-xs font-bold text-[var(--gl-brand)]">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              White-label de verdade
            </span>
            <h2
              className="mt-4 text-[clamp(1.875rem,2.5vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em] text-[var(--gl-ink)]"
              style={{ textWrap: "balance" }}
            >
              A marca que aparece é a do seu cliente. Sempre.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--gl-muted)]">
              A GoLive é organizada em três níveis —{" "}
              <strong className="font-semibold text-[var(--gl-ink)]">
                agência → cliente → evento
              </strong>{" "}
              — pensados pra quem revende ou opera múltiplos eventos ao mesmo
              tempo. Cada cliente tem cor, logo e página própria; a mesma
              plataforma por baixo, uma cara diferente por cima.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[var(--gl-ink)]">
              <li className="flex gap-2.5">
                <Palette className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gl-brand)]" />
                Cor de marca, logo e imagem de capa por cliente — sem você
                mexer em nada técnico
              </li>
              <li className="flex gap-2.5">
                <Palette className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gl-brand)]" />
                Permissões por evento — você decide quem modera chat, roda
                quiz ou vê relatório
              </li>
              <li className="flex gap-2.5">
                <Palette className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gl-brand)]" />
                Um painel de agência pra acompanhar todos os clientes e
                eventos de um lugar só
              </li>
            </ul>
          </Reveal>

          <Reveal delay={100} className="grid gap-5 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <div key={ex.name}>
                <BrowserFrame label={`suaagencia.com/${ex.name.toLowerCase().replace(" ", "-")}`}>
                  <div
                    className="flex flex-col items-center gap-2 px-4 py-8 text-center"
                    style={{ background: `color-mix(in oklch, ${ex.color} 6%, white)` }}
                  >
                    <span
                      className="grid h-10 w-10 place-items-center rounded-full text-sm font-black text-white"
                      style={{ background: ex.color }}
                    >
                      {ex.name.slice(-1)}
                    </span>
                    <p className="text-sm font-bold text-[var(--gl-ink)]">{ex.name}</p>
                    <p className="text-[11px] text-[var(--gl-muted)]">{ex.event}</p>
                    <span
                      className="mt-1 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                      style={{ background: ex.color }}
                    >
                      Entrar no evento
                    </span>
                  </div>
                </BrowserFrame>
                <p className="mt-2 text-center text-[11px] text-[var(--gl-muted)]">
                  Exemplo ilustrativo
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
